import { useToastStore } from '@/stores/toastStore';
import { useCallback } from 'react';

interface ToastOptions {
  icon: string;
  title: string;
  message?: string;
}

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);

  const toast = useCallback(
    (options: ToastOptions) => {
      addToast(options);
    },
    [addToast]
  );

  return { toast };
}
