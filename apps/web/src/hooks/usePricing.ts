import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricingApi } from '@/services/endpoints';
import { useToastStore } from '@/stores/toastStore';
import type {
  CreatePricingProductRequest,
  PricingPreviewRequest,
  PricingProduct,
  PricingSettings,
  UpdatePricingProductRequest,
  UpdatePricingSettingsRequest,
} from '@/types';

export function usePricingSettings() {
  return useQuery({
    queryKey: ['pricing', 'settings'],
    queryFn: pricingApi.settings,
  });
}

export function usePricingFinishes() {
  return useQuery({
    queryKey: ['pricing', 'finishes'],
    queryFn: pricingApi.finishes,
  });
}

export function usePricingProducts() {
  return useQuery({
    queryKey: ['pricing', 'products'],
    queryFn: pricingApi.products,
  });
}

export function useUpdatePricingSettings() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (data: UpdatePricingSettingsRequest) => pricingApi.updateSettings(data),
    onSuccess: (settings: PricingSettings) => {
      queryClient.invalidateQueries({ queryKey: ['pricing', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['pricing', 'products'] });
      addToast({
        icon: '⚙️',
        title: 'Multiplicador atualizado',
        message: `${settings.outsourcedMultiplier.toFixed(2)}x aplicado aos terceirizados`,
      });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao atualizar multiplicador premium' });
    },
  });
}

export function useCreatePricingProduct() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: (data: CreatePricingProductRequest) => pricingApi.createProduct(data),
    onSuccess: (product: PricingProduct) => {
      queryClient.invalidateQueries({ queryKey: ['pricing', 'products'] });
      addToast({
        icon: '✨',
        title: 'Produto premium criado',
        message: product.name,
      });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao criar produto premium' });
    },
  });
}

export function useUpdatePricingProduct() {
  const queryClient = useQueryClient();
  const addToast = useToastStore.getState().addToast;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePricingProductRequest }) => pricingApi.updateProduct(id, data),
    onSuccess: (product: PricingProduct) => {
      queryClient.invalidateQueries({ queryKey: ['pricing', 'products'] });
      addToast({
        icon: '💎',
        title: 'Produto atualizado',
        message: product.name,
      });
    },
    onError: () => {
      addToast({ icon: '❌', title: 'Erro ao salvar produto premium' });
    },
  });
}

export function usePricingPreview() {
  return useMutation({
    mutationFn: (data: PricingPreviewRequest) => pricingApi.preview(data),
  });
}
