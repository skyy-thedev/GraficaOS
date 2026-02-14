import { create } from 'zustand';

export interface ToastItem {
  id: string;
  icon: string;
  title: string;
  message?: string;
  removing?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id' | 'removing'>) => void;
  removeToast: (id: string) => void;
  markRemoving: (id: string) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, removing: false }],
    }));

    // Auto-dismiss em 3.5 segundos
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.map((t) =>
          t.id === id ? { ...t, removing: true } : t
        ),
      }));
      // Remove do DOM após a animação de saída (300ms)
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, 300);
    }, 3500);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  markRemoving: (id) =>
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, removing: true } : t
      ),
    })),
}));
