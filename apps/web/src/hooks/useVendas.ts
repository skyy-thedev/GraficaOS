import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vendasApi } from '@/services/endpoints';
import { useToastStore } from '@/stores/toastStore';
import type { CreateVendaRequest, UpdateVendaRequest, Venda } from '@/types';

export function useVendas() {
  return useQuery({
    queryKey: ['vendas'],
    queryFn: vendasApi.list,
  });
}

export function useCreateVenda() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (data: CreateVendaRequest) => vendasApi.create(data),
    onSuccess: (venda: Venda) => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      addToast({
        icon: venda.status === 'CONCLUIDA' ? '💸' : '🕒',
        title: venda.status === 'CONCLUIDA' ? 'Venda registrada' : 'Orçamento salvo em aguardo',
        message: `${venda.codigo} · ${venda.clienteNome || venda.produtoNome}`,
      });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao registrar venda', message: 'Revise os dados e tente novamente.' });
    },
  });
}

export function useUpdateVenda() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVendaRequest }) => vendasApi.update(id, data),
    onSuccess: (venda: Venda) => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      addToast({
        icon: venda.status === 'CONCLUIDA' ? '✅' : '📝',
        title: venda.status === 'CONCLUIDA' ? 'Venda concluída' : 'Registro atualizado',
        message: `${venda.codigo} · ${venda.clienteNome || venda.produtoNome}`,
      });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao atualizar venda' });
    },
  });
}
