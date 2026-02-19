import { api } from './api';
import type {
  AuthResponse,
  LoginRequest,
  User,
  Ponto,
  Arte,
  CreateUserRequest,
  UpdateUserRequest,
  CreateArteRequest,
  UpdateArteRequest,
  ArteStatus,
  ChecklistItemConfig,
  ItemHoje,
  RelatorioDia,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
  MetricasPonto,
}from '@/types';

// ===== Auth =====
export const authApi = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post<{ token: string }>('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout'),

  me: () =>
    api.get<User>('/auth/me').then((r) => r.data),
};

// ===== Users =====
export const usersApi = {
  list: () =>
    api.get<User[]>('/users').then((r) => r.data),

  create: (data: CreateUserRequest) =>
    api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: UpdateUserRequest) =>
    api.put<User>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),

  hardDelete: (id: string) =>
    api.delete(`/users/${id}/permanent`).then((r) => r.data),
};

// ===== Pontos =====
export const pontosApi = {
  list: () =>
    api.get<Ponto[]>('/pontos').then((r) => r.data),

  hoje: () =>
    api.get<Ponto | null>('/pontos/hoje').then((r) => r.data),

  bater: () =>
    api.post<Ponto>('/pontos/bater').then((r) => r.data),

  relatorio: (params: { userId?: string; startDate: string; endDate: string }) =>
    api.get<Ponto[]>('/pontos/relatorio', { params }).then((r) => r.data),

  metricas: (params: { userId?: string; startDate: string; endDate: string }) =>
    api.get<MetricasPonto>('/pontos/metricas', { params }).then((r) => r.data),

  exportCSV: (params: { userId?: string; startDate: string; endDate: string }) =>
    api.get('/pontos/export/csv', { params, responseType: 'blob' }).then((r) => r.data as Blob),

  exportXLSX: (params: { userId?: string; startDate: string; endDate: string }) =>
    api.get('/pontos/export/xlsx', { params, responseType: 'blob' }).then((r) => r.data as Blob),

  exportPDF: (params: { userId?: string; startDate: string; endDate: string }) =>
    api.get('/pontos/export/pdf', { params, responseType: 'blob' }).then((r) => r.data as Blob),

  enviarEmail: (params: { userId?: string; startDate: string; endDate: string; destinatario: string }) =>
    api.post<{ sent: boolean; message: string }>('/pontos/export/email', params).then((r) => r.data),
};

// ===== Artes =====
export const artesApi = {
  list: () =>
    api.get<Arte[]>('/artes').then((r) => r.data),

  create: (data: CreateArteRequest) =>
    api.post<Arte>('/artes', data).then((r) => r.data),

  update: (id: string, data: UpdateArteRequest) =>
    api.put<Arte>(`/artes/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: ArteStatus) =>
    api.put<Arte>(`/artes/${id}/status`, { status }).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/artes/${id}`),

  uploadArquivos: (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('arquivos', file));
    return api.post<Arte>(`/artes/${id}/arquivos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  deleteArquivo: (arteId: string, arquivoId: string) =>
    api.delete(`/artes/${arteId}/arquivos/${arquivoId}`),
};

// ===== Checklist =====
export const checklistApi = {
  // Itens (gerenciamento)
  listarItens: () =>
    api.get<ChecklistItemConfig[]>('/checklist/itens').then((r) => r.data),

  criarItem: (data: CreateChecklistItemRequest) =>
    api.post<ChecklistItemConfig>('/checklist/itens', data).then((r) => r.data),

  editarItem: (id: string, data: UpdateChecklistItemRequest) =>
    api.put<ChecklistItemConfig>(`/checklist/itens/${id}`, data).then((r) => r.data),

  toggleItem: (id: string) =>
    api.patch<ChecklistItemConfig>(`/checklist/itens/${id}/toggle`).then((r) => r.data),

  deletarItem: (id: string) =>
    api.delete(`/checklist/itens/${id}`).then((r) => r.data),

  // Registros do dia
  hoje: () =>
    api.get<ItemHoje[]>('/checklist/hoje').then((r) => r.data),

  marcar: (itemId: string) =>
    api.post<ItemHoje[]>(`/checklist/marcar/${itemId}`).then((r) => r.data),

  // Relatório
  relatorio: (params: { startDate: string; endDate: string }) =>
    api.get<RelatorioDia[]>('/checklist/relatorio', { params }).then((r) => r.data),
};
