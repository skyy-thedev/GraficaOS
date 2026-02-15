import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3333';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de request — adiciona o token JWT
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de response — faz refresh automático do token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se recebeu 401 e não é retry, tenta refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
          const { token } = response.data;

          useAuthStore.getState().setToken(token);
          originalRequest.headers.Authorization = `Bearer ${token}`;

          return api(originalRequest);
        } catch {
          // Refresh falhou — fazer logout
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export { api };
