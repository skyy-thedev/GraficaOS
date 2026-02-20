import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pontosApi } from '@/services/endpoints';
import { useToastStore } from '@/stores/toastStore';
import { format } from 'date-fns';
import type { Ponto } from '@/types';

export function usePontoHoje() {
  return useQuery({
    queryKey: ['ponto-hoje'],
    queryFn: pontosApi.hoje,
    refetchInterval: 30000, // Atualiza a cada 30s
  });
}

export function usePontos() {
  return useQuery({
    queryKey: ['pontos'],
    queryFn: pontosApi.list,
  });
}

/** Determina qual batida acabou de ser registrada baseado no estado do ponto retornado */
function detectBatidaLabel(ponto: Ponto): string {
  const hora = format(new Date(), 'HH:mm');
  if (ponto.saida) return `Saída registrada às ${hora}`;
  if (ponto.retorno) return `Retorno registrado às ${hora}`;
  if (ponto.almoco) return `Almoço registrado às ${hora}`;
  return `Entrada registrada às ${hora}`;
}

export function useBaterPonto() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: pontosApi.bater,
    onSuccess: (ponto: Ponto) => {
      queryClient.invalidateQueries({ queryKey: ['ponto-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['pontos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-metricas'] });
      addToast({ icon: '⏱️', title: 'Ponto registrado!', message: detectBatidaLabel(ponto) });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao registrar ponto' });
    },
  });
}

export function useRelatorio(params: { userId?: string; startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['relatorio', params],
    queryFn: () => pontosApi.relatorio(params),
    enabled: !!params.startDate && !!params.endDate,
  });
}

export function usePontoMetricas(params: { userId?: string; startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['ponto-metricas', params],
    queryFn: () => pontosApi.metricas(params),
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 60_000,
  });
}

/** Helpers de exportação */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useExportarPonto() {
  const addToast = useToastStore.getState().addToast;

  const exportCSV = useMutation({
    mutationFn: pontosApi.exportCSV,
    onSuccess: (blob) => {
      downloadBlob(blob, `pontos-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      addToast({ icon: '⬇️', title: 'Download iniciado!', message: 'pontos.csv' });
    },
    onError: () => addToast({ icon: '❌', title: 'Erro ao exportar CSV' }),
  });

  const exportXLSX = useMutation({
    mutationFn: pontosApi.exportXLSX,
    onSuccess: (blob) => {
      downloadBlob(blob, `pontos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      addToast({ icon: '⬇️', title: 'Download iniciado!', message: 'pontos.xlsx' });
    },
    onError: () => addToast({ icon: '❌', title: 'Erro ao exportar Excel' }),
  });

  const exportPDF = useMutation({
    mutationFn: pontosApi.exportPDF,
    onSuccess: (blob) => {
      downloadBlob(blob, `pontos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      addToast({ icon: '⬇️', title: 'Download iniciado!', message: 'pontos.pdf' });
    },
    onError: () => addToast({ icon: '❌', title: 'Erro ao exportar PDF' }),
  });

  const enviarEmail = useMutation({
    mutationFn: pontosApi.enviarEmail,
    onSuccess: (data) => {
      addToast({ icon: '📧', title: 'Email enviado!', message: data.message });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Erro ao enviar email. Verifique se o SMTP está configurado.';
      addToast({ icon: '❌', title: 'Erro ao enviar email', message: msg });
    },
  });

  return { exportCSV, exportXLSX, exportPDF, enviarEmail };
}
