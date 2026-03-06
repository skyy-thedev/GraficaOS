import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pontosApi } from '@/services/endpoints';
import { useToastStore } from '@/stores/toastStore';
import { format } from 'date-fns';
import type { Ponto } from '@/types';
import { getAgoraSP } from '@/utils/timezone';

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
  const hora = getAgoraSP().toFormat('HH:mm');
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

export function useAnomalias(params: { userId?: string; startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['ponto-anomalias', params],
    queryFn: () => pontosApi.anomalias(params),
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 60_000,
  });
}

export function useInsights(params: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['ponto-insights', params],
    queryFn: () => pontosApi.insights(params),
    enabled: !!params.startDate && !!params.endDate,
    staleTime: 60_000,
  });
}

export function useEditarPonto() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { entrada?: string | null; almoco?: string | null; retorno?: string | null; saida?: string | null; status?: string; date?: string } }) =>
      pontosApi.editar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ponto-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['pontos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-anomalias'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-insights'] });
      addToast({ icon: '✏️', title: 'Ponto atualizado!', message: 'Horários alterados com sucesso.' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao editar ponto', message: 'Não foi possível atualizar os horários.' });
    },
  });
}

export function useCriarPontoManual() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: pontosApi.criarManual,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pontos'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-metricas'] });
      addToast({ icon: '📝', title: 'Ponto manual criado!', message: 'Registro adicionado com sucesso.' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao criar ponto manual.';
      addToast({ icon: '❌', title: 'Erro ao criar ponto', message: msg });
    },
  });
}

export function useFolgas(userId?: string) {
  return useQuery({
    queryKey: ['folgas', userId],
    queryFn: () => pontosApi.listarFolgas(userId),
    staleTime: 60_000,
  });
}

export function useConfigurarFolgas() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: pontosApi.configurarFolgas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folgas'] });
      addToast({ icon: '🗓️', title: 'Folgas atualizadas!', message: 'Configuração de folgas salva.' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao configurar folgas' });
    },
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
