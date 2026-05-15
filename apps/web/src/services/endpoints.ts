import { api } from './api';
import type {
  AuthResponse,
  LoginRequest,
  User,
  Ponto,
  ComprovanteTokenResponse,
  Arte,
  CreateUserRequest,
  UpdateUserRequest,
  CreateArteRequest,
  UpdateArteRequest,
  ArteStatus,
  Venda,
  CreateVendaRequest,
  UpdateVendaRequest,
  PricingSettings,
  ProductFinish,
  PricingProduct,
  CreatePricingProductRequest,
  UpdatePricingProductRequest,
  UpdatePricingSettingsRequest,
  PricingPreviewRequest,
  PricingPreviewResult,
  ChecklistItemConfig,
  ItemHoje,
  RelatorioDia,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
  MetricasPonto,
  Anomalia,
  InsightsPeriodo,
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

  relatorio: (params: { userId?: string; loja?: import('@/types').Loja; startDate: string; endDate: string }) =>
    api.get<Ponto[]>('/pontos/relatorio', { params }).then((r) => r.data),

  metricas: (params: { userId?: string; loja?: import('@/types').Loja; startDate: string; endDate: string }) =>
    api.get<MetricasPonto>('/pontos/metricas', { params }).then((r) => r.data),

  anomalias: (params: { userId?: string; loja?: import('@/types').Loja; startDate: string; endDate: string }) =>
    api.get<Anomalia[]>('/pontos/anomalias', { params }).then((r) => r.data),

  insights: (params: { startDate: string; endDate: string; loja?: import('@/types').Loja }) =>
    api.get<InsightsPeriodo>('/pontos/insights', { params }).then((r) => r.data),

  gerarTokenComprovante: (id: string) =>
    api.get<ComprovanteTokenResponse>(`/pontos/${id}/comprovante-token`).then((r) => r.data),

  exportCSV: (params: { userId?: string; loja?: import('@/types').Loja; startDate: string; endDate: string }) =>
    api.get('/pontos/export/csv', { params, responseType: 'blob' }).then((r) => r.data as Blob),

  exportXLSX: (params: { userId?: string; loja?: import('@/types').Loja; startDate: string; endDate: string }) =>
    api.get('/pontos/export/xlsx', { params, responseType: 'blob' }).then((r) => r.data as Blob),

  exportPDF: (params: { userId?: string; loja?: import('@/types').Loja; startDate: string; endDate: string }) =>
    api.get('/pontos/export/pdf', { params, responseType: 'blob' }).then((r) => r.data as Blob),

  enviarEmail: (params: { userId?: string; loja?: import('@/types').Loja; startDate: string; endDate: string; destinatario: string }) =>
    api.post<{ sent: boolean; message: string }>('/pontos/export/email', params).then((r) => r.data),

  editar: (id: string, data: { entrada?: string | null; almoco?: string | null; retorno?: string | null; saida?: string | null; status?: string; date?: string }) =>
    api.put<Ponto>(`/pontos/${id}`, data).then((r) => r.data),

  criarManual: (data: { userId: string; date: string; entrada?: string | null; almoco?: string | null; retorno?: string | null; saida?: string | null; status?: string }) =>
    api.post<Ponto>('/pontos/manual', data).then((r) => r.data),

  listarFolgas: (userId?: string) =>
    api.get<import('@/types').FolgaConfig[]>('/pontos/folgas', { params: userId ? { userId } : {} }).then((r) => r.data),

  configurarFolgas: (data: { userId: string; diasSemana: number[] }) =>
    api.post<import('@/types').FolgaConfig[]>('/pontos/folgas', data).then((r) => r.data),
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

// ===== Vendas =====
export const vendasApi = {
  list: () =>
    api.get<Venda[]>('/vendas').then((r) => r.data),

  create: (data: CreateVendaRequest) =>
    api.post<Venda>('/vendas', data).then((r) => r.data),

  update: (id: string, data: UpdateVendaRequest) =>
    api.put<Venda>(`/vendas/${id}`, data).then((r) => r.data),
};

// ===== Precificação Premium =====
export const pricingApi = {
  settings: () =>
    api.get<PricingSettings>('/pricing/settings').then((r) => r.data),

  updateSettings: (data: UpdatePricingSettingsRequest) =>
    api.put<PricingSettings>('/pricing/settings', data).then((r) => r.data),

  finishes: () =>
    api.get<ProductFinish[]>('/pricing/finishes').then((r) => r.data),

  products: () =>
    api.get<PricingProduct[]>('/pricing/products').then((r) => r.data),

  createProduct: (data: CreatePricingProductRequest) =>
    api.post<PricingProduct>('/pricing/products', data).then((r) => r.data),

  updateProduct: (id: string, data: UpdatePricingProductRequest) =>
    api.put<PricingProduct>(`/pricing/products/${id}`, data).then((r) => r.data),

  preview: (data: PricingPreviewRequest) =>
    api.post<PricingPreviewResult>('/pricing/preview', data).then((r) => r.data),
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
