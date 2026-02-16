// ===== Tipos compartilhados do GráficaOS =====

export type Role = 'ADMIN' | 'EMPLOYEE';
export type ArteStatus = 'TODO' | 'DOING' | 'REVIEW' | 'DONE';
export type Urgencia = 'LOW' | 'NORMAL' | 'HIGH';
export type ProdutoTipo = 'AZULEJO' | 'BANNER' | 'ADESIVO' | 'PLACA' | 'FAIXA' | 'OUTRO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  initials: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Ponto {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'initials' | 'avatarColor'>;
  date: string;
  entrada: string | null;
  almoco: string | null;
  retorno: string | null;
  saida: string | null;
  horasTrabalhadas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Arquivo {
  id: string;
  arteId: string;
  nomeOriginal: string;
  nomeStorage: string;
  tipo: string;
  tamanho: number;
  url: string;
  createdAt: string;
}

export interface Arte {
  id: string;
  codigo: string;
  clienteNome: string;
  clienteNumero: string;
  orcamentoNum: string;
  produto: ProdutoTipo;
  quantidade: number;
  largura: number;
  altura: number;
  responsavelId: string;
  responsavel: Pick<User, 'id' | 'name' | 'initials' | 'avatarColor'>;
  status: ArteStatus;
  urgencia: Urgencia;
  prazo: string | null;
  observacoes: string | null;
  arquivos: Arquivo[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role?: Role;
  avatarColor?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  avatarColor?: string;
  active?: boolean;
}

export interface CreateArteRequest {
  clienteNome: string;
  clienteNumero: string;
  orcamentoNum: string;
  produto: ProdutoTipo;
  quantidade?: number;
  largura: number;
  altura: number;
  responsavelId: string;
  urgencia?: Urgencia;
  prazo?: string;
  observacoes?: string;
}

export interface UpdateArteRequest {
  clienteNome?: string;
  clienteNumero?: string;
  orcamentoNum?: string;
  produto?: ProdutoTipo;
  quantidade?: number;
  largura?: number;
  altura?: number;
  responsavelId?: string;
  urgencia?: Urgencia;
  prazo?: string | null;
  observacoes?: string | null;
}

// ===== Checklist Diário =====

export interface ChecklistItemConfig {
  id: string;
  titulo: string;
  descricao: string | null;
  horarioLimite: string | null;
  ordem: number;
  ativo: boolean;
}

export interface ItemHoje extends ChecklistItemConfig {
  feito: boolean;
  feitoEm: string | null;
  feitoPor: {
    id: string;
    name: string;
    initials: string;
    avatarColor: string;
  } | null;
  atrasado: boolean;
}

export interface RelatorioDia {
  data: string;
  totalItens: number;
  itensConcluidos: number;
  percentual: number;
  itens: {
    titulo: string;
    feito: boolean;
    feitoEm: string | null;
    feitoPor: string | null;
    horarioLimite: string | null;
    noHorario: boolean;
  }[];
}

export interface CreateChecklistItemRequest {
  titulo: string;
  descricao?: string;
  horarioLimite?: string;
  ordem?: number;
}

export interface UpdateChecklistItemRequest {
  titulo?: string;
  descricao?: string;
  horarioLimite?: string;
  ordem?: number;
}
