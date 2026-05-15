// ===== Tipos compartilhados do GráficaOS =====

export type Role = 'ADMIN' | 'EMPLOYEE';
export type Loja = 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II';
export type ArteStatus = 'TODO' | 'DOING' | 'REVIEW' | 'DONE';
export type Urgencia = 'LOW' | 'NORMAL' | 'HIGH';
export type ProdutoTipo =
  | 'AZULEJO'
  | 'BANNER'
  | 'ADESIVO'
  | 'ADESIVO_RECORTE'
  | 'LONA'
  | 'PLACA'
  | 'FAIXA'
  | 'CARTAO_VISITA'
  | 'PANFLETO'
  | 'FOLDER'
  | 'PERFURADO'
  | 'ENVELOPAMENTO'
  | 'BACKLIGHT'
  | 'OUTRO';
export type PontoStatus = 'NORMAL' | 'FOLGA' | 'FALTA';
export type VendaStatus = 'AGUARDANDO' | 'CONCLUIDA';
export type FormaPagamento = 'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'BOLETO' | 'TRANSFERENCIA' | 'OUTRO';
export type PricingMode = 'PROGRESSIVE' | 'FIXED' | 'OUTSOURCED';
export type ModifierType = 'FIXED' | 'PERCENTAGE';
export type PricingUrgency = 'NONE' | 'PRIORITARIO' | 'EXPRESS';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  loja: Loja;
  jornadaEntrada: string;
  jornadaSaida: string;
  avatarColor: string;
  initials: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Ponto {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'initials' | 'avatarColor' | 'loja'>;
  date: string;
  entrada: string | null;
  almoco: string | null;
  retorno: string | null;
  saida: string | null;
  status?: PontoStatus;
  encerramentoAutomatico?: boolean;
  horasTrabalhadas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComprovanteTokenResponse {
  token: string;
  urlValidacao: string;
}

export interface ComprovanteValidacao {
  pontoId: string;
  urlValidacao: string;
  verificadoEm: string;
  funcionario: {
    id: string;
    nome: string;
    loja: Loja;
    role: Role;
  };
  expediente: {
    data: string;
    status: PontoStatus;
    horasTrabalhadas: string | null;
    encerramentoAutomatico: boolean;
    emitidoEm: string;
  };
  registros: {
    entrada: string | null;
    almoco: string | null;
    retorno: string | null;
    saida: string | null;
  };
}

export interface FolgaConfig {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'initials' | 'avatarColor' | 'loja'>;
  diaSemana: number; // 0=DOM..6=SAB
  createdAt: string;
  updatedAt: string;
}

export interface MetricasPonto {
  periodo: { inicio: string; fim: string };
  totalDias: number;
  diasTrabalhados: number;
  diasFalta: number;
  percentualPresenca: number;
  totalHorasTrabalhadas: string;
  mediaHorasPorDia: string;
  diasPontuais: number;
  percentualPontualidade: number;
  streakAtual: number;
  maiorStreak: number;
  encerramentosAutomaticos: number;
  horasPorDia: { data: string; horas: number }[];
  frequenciaSemanal: { semana: string; presencas: number; total: number }[];
}

// ===== Anomalias =====

export type AnomaliaTipo =
  | 'JORNADA_EXCESSIVA'
  | 'INTERVALO_CURTO'
  | 'ENTRADA_MUITO_CEDO'
  | 'SAIDA_MUITO_TARDE'
  | 'MULTIPLAS_BATIDAS_RAPIDAS';

export type AnomaliaSeveridade = 'BAIXA' | 'MEDIA' | 'ALTA';

export interface Anomalia {
  pontoId: string;
  userId: string;
  userName: string;
  data: string;
  tipo: AnomaliaTipo;
  severidade: AnomaliaSeveridade;
  descricao: string;
  sugestao?: string;
}

// ===== Insights =====

export interface Destaque {
  tipo: 'POSITIVO' | 'NEUTRO' | 'ATENCAO';
  titulo: string;
  descricao: string;
  metrica?: string;
}

export interface FuncionarioDestaque {
  melhorPresenca: { nome: string; percentual: number } | null;
  melhorPontualidade: { nome: string; percentual: number } | null;
  maisHoras: { nome: string; horas: string } | null;
}

export interface InsightsPeriodo {
  periodo: { inicio: string; fim: string };
  destaques: Destaque[];
  funcionarioDestaque: FuncionarioDestaque;
  recomendacoes: string[];
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
  larguraCm: number;
  alturaCm: number;
  responsavelId: string;
  responsavel: Pick<User, 'id' | 'name' | 'initials' | 'avatarColor' | 'loja'>;
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
  loja?: Loja;
  jornadaEntrada?: string;
  jornadaSaida?: string;
  avatarColor?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  loja?: Loja;
  jornadaEntrada?: string;
  jornadaSaida?: string;
  avatarColor?: string;
  active?: boolean;
}

export interface CreateArteRequest {
  clienteNome: string;
  clienteNumero: string;
  orcamentoNum?: string;
  produto: ProdutoTipo;
  quantidade?: number;
  larguraCm: number;
  alturaCm: number;
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
  larguraCm?: number;
  alturaCm?: number;
  responsavelId?: string;
  urgencia?: Urgencia;
  prazo?: string | null;
  observacoes?: string | null;
}

export interface Venda {
  id: string;
  codigo: string;
  clienteNome: string | null;
  clienteDocumento: string | null;
  clienteTelefone: string | null;
  produto: ProdutoTipo | null;
  produtoNome: string;
  pricingProductId: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorOriginal: number | null;
  descontoPercent: number;
  subtotalBase: number | null;
  acabamentosValor: number;
  urgenciaValor: number;
  sizeVariationId: string | null;
  sizeVariationNome: string | null;
  acabamentos: Array<{
    id: string;
    name: string;
    pricingType: ModifierType;
    value: number;
    amount: number;
  }> | null;
  pricingSnapshot: PricingPreviewResult | null;
  urgenciaNivel: PricingUrgency;
  status: VendaStatus;
  formaPagamento: FormaPagamento | null;
  observacoes: string | null;
  finalizadaEm: string | null;
  createdAt: string;
  updatedAt: string;
  responsavelId: string;
  responsavel: Pick<User, 'id' | 'name' | 'initials' | 'avatarColor' | 'loja'>;
}

export interface CreateVendaRequest {
  clienteNome?: string;
  clienteDocumento?: string;
  clienteTelefone?: string;
  pricingProductId: string;
  quantidade: number;
  finishIds?: string[];
  sizeVariationId?: string;
  customWidthMeters?: number;
  customHeightMeters?: number;
  includeArtCreation?: boolean;
  descontoPercent?: number;
  urgencia?: PricingUrgency;
  status: VendaStatus;
  formaPagamento?: FormaPagamento;
  observacoes?: string;
}

export interface UpdateVendaRequest {
  clienteNome?: string | null;
  clienteDocumento?: string | null;
  status?: VendaStatus;
  formaPagamento?: FormaPagamento | null;
  observacoes?: string | null;
}

export interface PricingSettings {
  id: string;
  outsourcedMultiplier: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricingTier {
  id: string;
  productId: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFinish {
  id: string;
  name: string;
  type: string;
  value: number;
  pricingType: ModifierType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSizeVariation {
  id: string;
  productId: string;
  name: string;
  widthCm: number | null;
  heightCm: number | null;
  value: number;
  pricingType: ModifierType;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricingProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  premiumCategory: string | null;
  legacyProdutoTipo: ProdutoTipo | null;
  isOutsourced: boolean;
  supplierCost: number | null;
  pricingMode: PricingMode;
  fixedUnitPrice: number | null;
  urgencyEnabled: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  pricingTiers: PricingTier[];
  sizeVariations: ProductSizeVariation[];
  availableFinishes: ProductFinish[];
  availableFinishIds: string[];
}

export interface PricingTierInput {
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
}

export interface ProductSizeVariationInput {
  name: string;
  widthCm?: number | null;
  heightCm?: number | null;
  value?: number;
  pricingType?: ModifierType;
  sortOrder?: number;
}

export interface CreatePricingProductRequest {
  name: string;
  description?: string;
  category: string;
  premiumCategory?: string;
  legacyProdutoTipo?: ProdutoTipo | null;
  isOutsourced?: boolean;
  supplierCost?: number | null;
  pricingMode: PricingMode;
  fixedUnitPrice?: number | null;
  urgencyEnabled?: boolean;
  active?: boolean;
  sortOrder?: number;
  pricingTiers?: PricingTierInput[];
  sizeVariations?: ProductSizeVariationInput[];
  finishIds?: string[];
}

export interface UpdatePricingProductRequest extends Partial<CreatePricingProductRequest> {}

export interface UpdatePricingSettingsRequest {
  outsourcedMultiplier: number;
}

export interface PricingPreviewRequest {
  productId: string;
  quantity: number;
  finishIds?: string[];
  sizeVariationId?: string;
  customWidthMeters?: number;
  customHeightMeters?: number;
  includeArtCreation?: boolean;
  urgency?: PricingUrgency;
}

export interface PricingPreviewResult {
  product: PricingProduct;
  settings: PricingSettings;
  quantity: number;
  pricingStrategy: 'progressive' | 'fixed' | 'outsourced';
  baseUnitPrice: number;
  baseSubtotal: number;
  matchedTier: {
    id: string;
    minQuantity: number;
    maxQuantity: number | null;
    unitPrice: number;
  } | null;
  selectedSizeVariation: {
    id: string;
    name: string;
    pricingType: ModifierType;
    value: number;
    amount: number;
  } | null;
  selectedFinishes: Array<{
    id: string;
    name: string;
    pricingType: ModifierType;
    value: number;
    amount: number;
  }>;
  finishesAmount: number;
  artCreationAmount: number;
  subtotalBeforeUrgency: number;
  urgency: {
    level: PricingUrgency;
    percentage: number;
    amount: number;
    enabled: boolean;
  };
  outsourcedMultiplier: number;
  customDimensions: {
    widthMeters: number;
    heightMeters: number;
    areaSquareMeters: number;
    pricePerSquareMeter: number;
  } | null;
  total: number;
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
