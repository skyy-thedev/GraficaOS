import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

function resolveApiBase() {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3333';
  }

  return '';
}

const API_BASE = resolveApiBase();

export { API_BASE };

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
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
          const refreshUrl = API_BASE ? `${API_BASE}/api/auth/refresh` : '/api/auth/refresh';
          const response = await axios.post(refreshUrl, { refreshToken });
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
