import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { artesApi } from '@/services/endpoints';
import { useToastStore } from '@/stores/toastStore';
import type { CreateArteRequest, UpdateArteRequest, ArteStatus, Arte } from '@/types';

const STATUS_LABELS: Record<ArteStatus, string> = {
  TODO: 'A Fazer',
  DOING: 'Fazendo',
  REVIEW: 'Revisão',
  DONE: 'Concluído',
};

export function useArtes() {
  return useQuery({
    queryKey: ['artes'],
    queryFn: artesApi.list,
  });
}

export function useCreateArte() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (data: CreateArteRequest) => artesApi.create(data),
    onSuccess: (arte: Arte) => {
      queryClient.invalidateQueries({ queryKey: ['artes'] });
      addToast({ icon: '✅', title: 'Arte criada!', message: `${arte.codigo} · ${arte.clienteNome}` });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao criar arte', message: 'Verifique os dados e tente novamente.' });
    },
  });
}

export function useUpdateArte() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateArteRequest }) =>
      artesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artes'] });
      addToast({ icon: '✅', title: 'Arte atualizada!' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao atualizar arte' });
    },
  });
}

export function useUpdateArteStatus() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ArteStatus }) =>
      artesApi.updateStatus(id, status),
    onSuccess: (_data: Arte, variables: { id: string; status: ArteStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['artes'] });
      addToast({ icon: '🎨', title: 'Status atualizado', message: `→ ${STATUS_LABELS[variables.status]}` });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao atualizar status' });
    },
  });
}

export function useDeleteArte() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (id: string) => artesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artes'] });
      addToast({ icon: '🗑️', title: 'Arte removida' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao remover arte' });
    },
  });
}

export function useUploadArquivos() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) =>
      artesApi.uploadArquivos(id, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artes'] });
      addToast({ icon: '📎', title: 'Arquivo anexado' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao enviar arquivo' });
    },
  });
}

export function useDeleteArquivo() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ arteId, arquivoId }: { arteId: string; arquivoId: string }) =>
      artesApi.deleteArquivo(arteId, arquivoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artes'] });
      addToast({ icon: '🗑️', title: 'Arquivo removido' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao remover arquivo' });
    },
  });
}
