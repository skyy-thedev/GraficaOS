import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/endpoints';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import type { LoginRequest } from '@/types';

export function useAuth() {
  const { user, isAuthenticated, setAuth, logout: clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    setAuth(response.token, response.refreshToken, response.user);
    navigate('/');
  }, [setAuth, navigate]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignora erro no logout — limpa estado local de qualquer forma
    }
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  return {
    user,
    isAuthenticated,
    isAdmin: user?.role === 'ADMIN',
    login,
    logout,
  };
}
