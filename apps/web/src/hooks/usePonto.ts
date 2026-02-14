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
