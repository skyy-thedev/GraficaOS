import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/services/endpoints';
import { useToastStore } from '@/stores/toastStore';
import type { CreateUserRequest, UpdateUserRequest, User } from '@/types';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (data: CreateUserRequest) => usersApi.create(data),
    onSuccess: (user: User) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast({ icon: '✅', title: 'Funcionário criado!', message: user.name });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao criar funcionário' });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast({ icon: '✅', title: 'Dados atualizados' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao atualizar funcionário' });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast({ icon: '⚠️', title: 'Funcionário desativado' });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao desativar funcionário' });
    },
  });
}
