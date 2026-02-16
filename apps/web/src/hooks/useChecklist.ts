import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checklistApi } from '@/services/endpoints';
import { useToastStore } from '@/stores/toastStore';
import type {
  ItemHoje,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
} from '@/types';

// ===== Checklist do dia =====

export function useChecklistHoje() {
  return useQuery({
    queryKey: ['checklist', 'hoje'],
    queryFn: checklistApi.hoje,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useMarcarItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (itemId: string) => checklistApi.marcar(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['checklist', 'hoje'] });
      const anterior = queryClient.getQueryData<ItemHoje[]>(['checklist', 'hoje']);

      queryClient.setQueryData<ItemHoje[]>(['checklist', 'hoje'], (old) =>
        old?.map((item) =>
          item.id === itemId
            ? { ...item, feito: !item.feito, atrasado: false }
            : item,
        ),
      );

      return { anterior };
    },
    onSuccess: (data, _itemId) => {
      // Use server data
      queryClient.setQueryData(['checklist', 'hoje'], data);
    },
    onError: (_err, _itemId, context) => {
      queryClient.setQueryData(['checklist', 'hoje'], context?.anterior);
      addToast({ icon: '❌', title: 'Erro ao atualizar checklist' });
    },
  });
}

// ===== Gerenciamento de itens (ADMIN) =====

export function useChecklistItens() {
  return useQuery({
    queryKey: ['checklist', 'itens'],
    queryFn: checklistApi.listarItens,
  });
}

export function useCriarChecklistItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (data: CreateChecklistItemRequest) => checklistApi.criarItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      addToast({ icon: '✅', title: 'Item criado!' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao criar item' });
    },
  });
}

export function useEditarChecklistItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChecklistItemRequest }) =>
      checklistApi.editarItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      addToast({ icon: '✅', title: 'Item atualizado!' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao atualizar item' });
    },
  });
}

export function useToggleChecklistItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (id: string) => checklistApi.toggleItem(id),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      addToast({
        icon: item.ativo ? '✅' : '⏸️',
        title: item.ativo ? 'Item ativado' : 'Item desativado',
      });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao alterar item' });
    },
  });
}

export function useDeletarChecklistItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (id: string) => checklistApi.deletarItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      addToast({ icon: '🗑️', title: 'Item removido' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao remover item' });
    },
  });
}

// ===== Relatório =====

export function useRelatorioChecklist(startDate: string, endDate: string, enabled: boolean) {
  return useQuery({
    queryKey: ['checklist', 'relatorio', startDate, endDate],
    queryFn: () => checklistApi.relatorio({ startDate, endDate }),
    enabled,
  });
}
