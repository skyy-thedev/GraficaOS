import { ModifierType, PricingMode, ProdutoTipo, Prisma } from '@prisma/client';
import { prisma } from '../prisma/client';

interface PricingTierInput {
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
}

interface ProductSizeVariationInput {
  name: string;
  widthCm?: number | null;
  heightCm?: number | null;
  value?: number;
  pricingType?: ModifierType;
  sortOrder?: number;
}

interface ProductInput {
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

interface PreviewPricingInput {
  productId: string;
  quantity: number;
  finishIds?: string[];
  sizeVariationId?: string;
  customWidthMeters?: number;
  customHeightMeters?: number;
  includeArtCreation?: boolean;
  urgency?: 'NONE' | 'PRIORITARIO' | 'EXPRESS';
}

const productInclude = {
  pricingTiers: {
    orderBy: { minQuantity: 'asc' },
  },
  sizeVariations: {
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  },
  finishLinks: {
    include: {
      finish: true,
    },
  },
} satisfies Prisma.ProductInclude;

const INITIAL_FINISHES: Array<{ name: string; type: string; value: number; pricingType: ModifierType }> = [
  { name: 'Encadernação', type: 'BINDING', value: 19.9, pricingType: 'FIXED' },
  { name: 'Corte', type: 'SPECIAL_CUT', value: 9.9, pricingType: 'FIXED' },
  { name: 'Vinco', type: 'CREASE_FOLD', value: 4.9, pricingType: 'FIXED' },
  { name: 'Laminação Brilho', type: 'LAMINATION', value: 30, pricingType: 'PERCENTAGE' },
  { name: 'Laminação Fosca', type: 'LAMINATION', value: 30, pricingType: 'PERCENTAGE' },
];

const A4_PAPER_VARIATIONS: ProductSizeVariationInput[] = [
  // Somente Frente — valor adicional por página sobre a faixa base
  { name: 'Sulfite|75g|Frente', value: 0, pricingType: 'FIXED', sortOrder: 0 },
  { name: 'Couchê|115g|Frente', value: 1.2, pricingType: 'FIXED', sortOrder: 10 },
  { name: 'Couchê|170g|Frente', value: 2.2, pricingType: 'FIXED', sortOrder: 20 },
  { name: 'Couchê|250g|Frente', value: 3.8, pricingType: 'FIXED', sortOrder: 30 },
  { name: 'Vergê|180g|Frente', value: 2.6, pricingType: 'FIXED', sortOrder: 40 },
  // Frente e Verso — acresce +0.9/página pelo segundo passe de impressão
  { name: 'Sulfite|75g|F+V', value: 0.9, pricingType: 'FIXED', sortOrder: 50 },
  { name: 'Couchê|115g|F+V', value: 2.1, pricingType: 'FIXED', sortOrder: 60 },
  { name: 'Couchê|170g|F+V', value: 3.1, pricingType: 'FIXED', sortOrder: 70 },
  { name: 'Couchê|250g|F+V', value: 4.7, pricingType: 'FIXED', sortOrder: 80 },
  { name: 'Vergê|180g|F+V', value: 3.5, pricingType: 'FIXED', sortOrder: 90 },
];

const A3_PAPER_VARIATIONS: ProductSizeVariationInput[] = [
  // Somente Frente
  { name: 'Sulfite|75g|Frente', value: 0, pricingType: 'FIXED', sortOrder: 0 },
  { name: 'Couchê|115g|Frente', value: 2.4, pricingType: 'FIXED', sortOrder: 10 },
  { name: 'Couchê|170g|Frente', value: 4.4, pricingType: 'FIXED', sortOrder: 20 },
  { name: 'Couchê|250g|Frente', value: 7.6, pricingType: 'FIXED', sortOrder: 30 },
  { name: 'Vergê|180g|Frente', value: 5.2, pricingType: 'FIXED', sortOrder: 40 },
  // Frente e Verso — acresce +1.8/página pelo segundo passe (A3 = área dupla)
  { name: 'Sulfite|75g|F+V', value: 1.8, pricingType: 'FIXED', sortOrder: 50 },
  { name: 'Couchê|115g|F+V', value: 4.2, pricingType: 'FIXED', sortOrder: 60 },
  { name: 'Couchê|170g|F+V', value: 6.2, pricingType: 'FIXED', sortOrder: 70 },
  { name: 'Couchê|250g|F+V', value: 9.4, pricingType: 'FIXED', sortOrder: 80 },
  { name: 'Vergê|180g|F+V', value: 7.0, pricingType: 'FIXED', sortOrder: 90 },
];

const CARD_SIDE_VARIATIONS: ProductSizeVariationInput[] = [
  { name: 'Somente Frente', value: 0, pricingType: 'FIXED', sortOrder: 0 },
  { name: 'Frente e Verso', value: 12, pricingType: 'FIXED', sortOrder: 10 },
];

const INITIAL_PRODUCTS: Array<{
  name: string;
  description: string;
  category: string;
  premiumCategory: string;
  sortOrder: number;
  pricingMode?: PricingMode;
  isOutsourced?: boolean;
  supplierCost?: number | null;
  fixedUnitPrice?: number | null;
  pricingTiers?: PricingTierInput[];
  sizeVariations?: ProductSizeVariationInput[];
  legacyProdutoTipo?: ProdutoTipo | null;
}> = [
  {
    name: 'Impressão A4 PB',
    description: 'Linha interna para produção rápida com tabela progressiva por volume.',
    category: 'Impressão Interna',
    premiumCategory: 'Operação Expressa',
    sortOrder: 10,
    pricingMode: 'PROGRESSIVE',
    legacyProdutoTipo: null,
    sizeVariations: A4_PAPER_VARIATIONS,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 3.0 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 2.5 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 1.9 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 1.4 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 1.0 },
    ],
  },
  {
    name: 'Impressão A4 Colorido',
    description: 'Acabamento colorido premium com ganho progressivo por tiragem.',
    category: 'Impressão Interna',
    premiumCategory: 'Linha Corporativa',
    sortOrder: 20,
    pricingMode: 'PROGRESSIVE',
    legacyProdutoTipo: null,
    sizeVariations: A4_PAPER_VARIATIONS,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 8.9 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 7.5 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 5.9 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 4.5 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 2.9 },
    ],
  },
  {
    name: 'Impressão A3 PB',
    description: 'Formato ampliado em preto e branco com precificação por escala.',
    category: 'Impressão Interna',
    premiumCategory: 'Grandes Formatos',
    sortOrder: 30,
    pricingMode: 'PROGRESSIVE',
    legacyProdutoTipo: null,
    sizeVariations: A3_PAPER_VARIATIONS,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 6.9 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 5.9 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 4.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 3.2 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 2.2 },
    ],
  },
  {
    name: 'Impressão A3 Colorido',
    description: 'Formato premium colorido para materiais high-ticket e apresentações.',
    category: 'Impressão Interna',
    premiumCategory: 'Grandes Formatos',
    sortOrder: 40,
    pricingMode: 'PROGRESSIVE',
    legacyProdutoTipo: null,
    sizeVariations: A3_PAPER_VARIATIONS,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 15.9 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 13.9 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 10.9 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 7.9 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 4.9 },
    ],
  },
  {
    name: 'Plastificação RG',
    description: 'Serviço rápido de plastificação no formato RG para balcão e retirada expressa.',
    category: 'Acabamentos Rápidos',
    premiumCategory: 'Operação Expressa',
    sortOrder: 50,
    pricingMode: 'FIXED',
    fixedUnitPrice: 8.9,
    legacyProdutoTipo: null,
  },
  {
    name: 'Plastificação A4',
    description: 'Serviço avulso de plastificação A4 com valor fixo para venda rápida.',
    category: 'Acabamentos Rápidos',
    premiumCategory: 'Operação Expressa',
    sortOrder: 60,
    pricingMode: 'FIXED',
    fixedUnitPrice: 14.9,
    legacyProdutoTipo: null,
  },
  {
    name: 'Caneca Branca Personalizada',
    description: 'Caneca branca personalizada com valor unitário fixo.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Canecas',
    sortOrder: 95,
    pricingMode: 'FIXED',
    fixedUnitPrice: 37,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Caneca Alça e Interior Colorido',
    description: 'Caneca personalizada com alça e interior colorido.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Canecas',
    sortOrder: 96,
    pricingMode: 'FIXED',
    fixedUnitPrice: 47,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Caneca Alça Coração',
    description: 'Caneca personalizada com alça em formato de coração.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Canecas',
    sortOrder: 97,
    pricingMode: 'FIXED',
    fixedUnitPrice: 57,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Caneca Colher Personalizada',
    description: 'Caneca personalizada com colher e acabamento premium.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Canecas',
    sortOrder: 98,
    pricingMode: 'FIXED',
    fixedUnitPrice: 67,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Foto 10x15',
    description: 'Foto instantânea com curva progressiva até valor balcão otimizado para grandes tiragens.',
    category: 'Fotografia Instantânea',
    premiumCategory: 'Operação Expressa',
    sortOrder: 70,
    pricingMode: 'PROGRESSIVE',
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 5.5 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 5.0 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 4.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 4.0 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 3.5 },
    ],
  },
  {
    name: 'Foto 13x18',
    description: 'Foto premium 13x18 com desconto progressivo para lotes maiores.',
    category: 'Fotografia Instantânea',
    premiumCategory: 'Linha Corporativa',
    sortOrder: 80,
    pricingMode: 'PROGRESSIVE',
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 10.0 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 9.0 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 8.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 7.8 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 7.0 },
    ],
  },
  {
    name: 'Foto 15x20',
    description: 'Foto premium 15x20 com curva progressiva para venda avulsa e tiragens maiores.',
    category: 'Fotografia Instantânea',
    premiumCategory: 'Linha Corporativa',
    sortOrder: 90,
    pricingMode: 'PROGRESSIVE',
    legacyProdutoTipo: null,
    pricingTiers: [
      { minQuantity: 1, maxQuantity: 1, unitPrice: 10.0 },
      { minQuantity: 2, maxQuantity: 10, unitPrice: 9.0 },
      { minQuantity: 11, maxQuantity: 30, unitPrice: 8.5 },
      { minQuantity: 31, maxQuantity: 100, unitPrice: 7.8 },
      { minQuantity: 101, maxQuantity: null, unitPrice: 7.0 },
    ],
  },
  {
    name: 'Porta Retrato 10x15',
    description: 'Porta retrato personalizado tamanho 10x15 com valor unitário fixo.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Porta Retratos',
    sortOrder: 100,
    pricingMode: 'FIXED',
    fixedUnitPrice: 35,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Porta Retrato 15x20',
    description: 'Porta retrato personalizado tamanho 15x20 com valor unitário fixo.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Porta Retratos',
    sortOrder: 101,
    pricingMode: 'FIXED',
    fixedUnitPrice: 45,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Gravação a Laser',
    description: 'Serviço unitário de gravação a laser.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Laser',
    sortOrder: 102,
    pricingMode: 'FIXED',
    fixedUnitPrice: 45,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Criação de Arte Simples',
    description: 'Desenvolvimento de arte simples com valor fixo.',
    category: 'Serviços Criativos',
    premiumCategory: 'Arte e Design',
    sortOrder: 103,
    pricingMode: 'FIXED',
    fixedUnitPrice: 40,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Edição de Arte Pronta',
    description: 'Ajuste de arte enviada pelo cliente.',
    category: 'Serviços Criativos',
    premiumCategory: 'Arte e Design',
    sortOrder: 104,
    pricingMode: 'FIXED',
    fixedUnitPrice: 60,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Vetorização de Logo',
    description: 'Vetorização de logotipo com valor fixo.',
    category: 'Serviços Criativos',
    premiumCategory: 'Arte e Design',
    sortOrder: 105,
    pricingMode: 'FIXED',
    fixedUnitPrice: 60,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Criação de Arte Complexa',
    description: 'Valor inicial para arte complexa; consultar complexidade do projeto.',
    category: 'Serviços Criativos',
    premiumCategory: 'Arte e Design',
    sortOrder: 106,
    pricingMode: 'FIXED',
    fixedUnitPrice: 120,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Impressão 3D',
    description: 'Valor inicial para impressão 3D; consultar complexidade e material.',
    category: 'Brindes Personalizados',
    premiumCategory: 'Impressão 3D',
    sortOrder: 107,
    pricingMode: 'FIXED',
    fixedUnitPrice: 150,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'QR Code Personalizado',
    description: 'Geração de QR Code personalizado com valor unitário fixo.',
    category: 'Serviços Criativos',
    premiumCategory: 'Marketing Rápido',
    sortOrder: 108,
    pricingMode: 'FIXED',
    fixedUnitPrice: 20,
    legacyProdutoTipo: 'OUTRO',
  },
  {
    name: 'Banner Personalizado',
    description: 'Preço base por m². Cálculo final: altura × largura × preço base do m².',
    category: 'Comunicação Visual',
    premiumCategory: 'Preço por m²',
    sortOrder: 109,
    pricingMode: 'FIXED',
    fixedUnitPrice: 85,
    legacyProdutoTipo: 'BANNER',
  },
  {
    name: 'Cartão Couchê 300g 100un',
    description: 'Cartão de visita terceirizado com regra comercial premium.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    sortOrder: 110,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 45.99,
    sizeVariations: CARD_SIDE_VARIATIONS,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Cartão Premium 600g',
    description: 'Linha premium para cartões robustos com percepção high-ticket.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    sortOrder: 120,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 73.99,
    sizeVariations: CARD_SIDE_VARIATIONS,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Cartão Hot Stamping',
    description: 'Cartão terceirizado com acabamento premium metalizado.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    sortOrder: 130,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 80.99,
    sizeVariations: CARD_SIDE_VARIATIONS,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Cartão Holográfico',
    description: 'Versão terceirizada com apelo visual premium e acabamento holográfico.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    sortOrder: 140,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 55.99,
    sizeVariations: CARD_SIDE_VARIATIONS,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'PVC Premium',
    description: 'Cartão em PVC terceirizado com valor agregado e venda corporativa.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Cartões de Visita',
    sortOrder: 150,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 57.99,
    sizeVariations: CARD_SIDE_VARIATIONS,
    legacyProdutoTipo: 'CARTAO_VISITA',
  },
  {
    name: 'Flyer Couchê 10x15',
    description: 'Flyer terceirizado para campanhas promocionais com cálculo premium automático.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Flyers e Panfletos',
    sortOrder: 160,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 32.9,
    legacyProdutoTipo: 'PANFLETO',
  },
  {
    name: 'Folder 1 Dobra',
    description: 'Folder terceirizado com uma dobra para apresentações institucionais mais enxutas.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Folders e Institucionais',
    sortOrder: 165,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 39.9,
    legacyProdutoTipo: 'FOLDER',
  },
  {
    name: 'Folder 2 Dobras',
    description: 'Folder terceirizado para apresentação corporativa com margem premium.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Folders e Institucionais',
    sortOrder: 170,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 49.9,
    legacyProdutoTipo: 'FOLDER',
  },
  {
    name: 'Folder Sanfona',
    description: 'Folder terceirizado em formato sanfona para materiais com mais blocos de informação.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Folders e Institucionais',
    sortOrder: 175,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 59.9,
    legacyProdutoTipo: 'FOLDER',
  },
  {
    name: 'Folder Carteira',
    description: 'Folder terceirizado em dobra carteira para campanhas promocionais e apresentações comerciais.',
    category: 'Terceirização Estratégica',
    premiumCategory: 'Folders e Institucionais',
    sortOrder: 180,
    pricingMode: 'OUTSOURCED',
    isOutsourced: true,
    supplierCost: 54.9,
    legacyProdutoTipo: 'FOLDER',
  },
];

function trimOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isAreaPricedProduct(product: { name: string; premiumCategory?: string | null; fixedUnitPrice?: number | null }) {
  return /banner/i.test(product.name) || (product.premiumCategory ?? '').toLowerCase().includes('m²');
}

function supportsArtCreation(product: { name: string; legacyProdutoTipo?: ProdutoTipo | null }) {
  return /banner|flyer/i.test(product.name) || product.legacyProdutoTipo === 'CARTAO_VISITA';
}

function resolveArtCreationAmount(product: { name: string; legacyProdutoTipo?: ProdutoTipo | null }, includeArtCreation?: boolean) {
  if (!includeArtCreation || !supportsArtCreation(product)) {
    return 0;
  }

  return product.legacyProdutoTipo === 'CARTAO_VISITA' ? 120 : 60;
}

function normalizeProductPayload(product: typeof INITIAL_PRODUCTS[number], finishIds: string[]) {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    premiumCategory: product.premiumCategory,
    legacyProdutoTipo: product.legacyProdutoTipo ?? null,
    isOutsourced: product.isOutsourced ?? false,
    supplierCost: product.supplierCost ?? null,
    pricingMode: product.pricingMode ?? 'PROGRESSIVE',
    fixedUnitPrice: product.fixedUnitPrice ?? null,
    urgencyEnabled: true,
    active: true,
    sortOrder: product.sortOrder,
    pricingTiers: (product.pricingTiers ?? []).map((tier) => ({
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity ?? null,
      unitPrice: tier.unitPrice,
    })),
    sizeVariations: (product.sizeVariations ?? []).map((variation, index) => ({
      name: variation.name.trim(),
      widthCm: variation.widthCm ?? null,
      heightCm: variation.heightCm ?? null,
      value: Number((variation.value ?? 0).toFixed(2)),
      pricingType: variation.pricingType ?? 'FIXED',
      sortOrder: variation.sortOrder ?? index,
    })),
    finishIds,
  };
}

function normalizeTier(tier: PricingTierInput): PricingTierInput {
  return {
    minQuantity: tier.minQuantity,
    maxQuantity: tier.maxQuantity ?? null,
    unitPrice: Number(tier.unitPrice.toFixed(2)),
  };
}

function validatePricingTiers(tiers: PricingTierInput[]) {
  if (tiers.length === 0) {
    throw Object.assign(new Error('Produtos progressivos precisam ter ao menos uma faixa de preço'), { statusCode: 400 });
  }

  const ordered = [...tiers]
    .map(normalizeTier)
    .sort((first, second) => first.minQuantity - second.minQuantity);

  if (ordered[0]?.minQuantity !== 1) {
    throw Object.assign(new Error('A primeira faixa deve começar em 1 unidade'), { statusCode: 400 });
  }

  ordered.forEach((tier, index) => {
    const maxQuantity = tier.maxQuantity ?? null;

    if (maxQuantity !== null && maxQuantity < tier.minQuantity) {
      throw Object.assign(new Error('Faixa com quantidade máxima menor que a mínima'), { statusCode: 400 });
    }

    const next = ordered[index + 1];
    if (!next) return;

    if (maxQuantity === null) {
      throw Object.assign(new Error('Faixa aberta deve ser a última da tabela'), { statusCode: 400 });
    }

    if (next.minQuantity !== maxQuantity + 1) {
      throw Object.assign(new Error('As faixas devem ser contínuas, sem sobreposição ou lacunas'), { statusCode: 400 });
    }
  });
}

function validateProductInput(input: ProductInput) {
  const resolvedMode = input.isOutsourced ? 'OUTSOURCED' : input.pricingMode;

  if (resolvedMode === 'PROGRESSIVE') {
    validatePricingTiers(input.pricingTiers ?? []);
  }

  if (resolvedMode === 'FIXED' && (input.fixedUnitPrice ?? 0) <= 0) {
    throw Object.assign(new Error('Informe um preço unitário fixo para produtos em modo fixo'), { statusCode: 400 });
  }

  if (resolvedMode === 'OUTSOURCED' && (input.supplierCost ?? 0) <= 0) {
    throw Object.assign(new Error('Informe o custo do fornecedor para produtos terceirizados'), { statusCode: 400 });
  }
}

function serializeProduct(product: Prisma.ProductGetPayload<{ include: typeof productInclude }>) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    premiumCategory: product.premiumCategory,
    legacyProdutoTipo: product.legacyProdutoTipo,
    isOutsourced: product.isOutsourced,
    supplierCost: product.supplierCost,
    pricingMode: product.pricingMode,
    fixedUnitPrice: product.fixedUnitPrice,
    urgencyEnabled: product.urgencyEnabled,
    active: product.active,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    pricingTiers: product.pricingTiers,
    sizeVariations: product.sizeVariations,
    availableFinishes: product.finishLinks
      .map((link) => link.finish)
      .sort((first, second) => first.name.localeCompare(second.name)),
    availableFinishIds: product.finishLinks.map((link) => link.finishId),
  };
}

async function ensurePricingBootstrap() {
  await prisma.pricingSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      outsourcedMultiplier: 2.5,
    },
  });

  const existingFinishes = await prisma.productFinish.findMany({
    select: { name: true },
  });

  const existingFinishNames = new Set(existingFinishes.map((finish) => finish.name));
  const missingFinishes = INITIAL_FINISHES.filter((finish) => !existingFinishNames.has(finish.name));

  if (missingFinishes.length > 0) {
    await prisma.productFinish.createMany({ data: missingFinishes });
  }

  for (const finish of INITIAL_FINISHES) {
    await prisma.productFinish.updateMany({
      where: { name: finish.name },
      data: {
        type: finish.type,
        value: finish.value,
        pricingType: finish.pricingType,
        active: true,
      },
    });
  }

  await prisma.productFinish.updateMany({
    where: { name: { in: ['Plastificação A4', 'Laminação Holográfica', 'Corte Especial', 'Vinco/Dobra'] } },
    data: { active: false },
  });

  const existingProducts = await prisma.product.findMany({
    select: { name: true },
  });
  const existingProductNames = new Set(existingProducts.map((product) => product.name));

  const finishes = await prisma.productFinish.findMany({
    where: { name: { in: INITIAL_FINISHES.map((finish) => finish.name) }, active: true },
    select: { id: true },
  });

  for (const product of INITIAL_PRODUCTS) {
    if (existingProductNames.has(product.name)) {
      continue;
    }

    const normalized = normalizeProductPayload(product, finishes.map((finish) => finish.id));

    await prisma.product.create({
      data: {
        name: normalized.name,
        description: normalized.description,
        category: normalized.category,
        premiumCategory: normalized.premiumCategory,
        legacyProdutoTipo: normalized.legacyProdutoTipo,
        isOutsourced: normalized.isOutsourced,
        supplierCost: normalized.supplierCost,
        pricingMode: normalized.pricingMode,
        fixedUnitPrice: normalized.fixedUnitPrice,
        urgencyEnabled: normalized.urgencyEnabled,
        active: normalized.active,
        sortOrder: normalized.sortOrder,
        pricingTiers: {
          create: normalized.pricingTiers,
        },
        sizeVariations: {
          create: normalized.sizeVariations,
        },
        finishLinks: {
          create: normalized.finishIds.map((finishId) => ({ finishId })),
        },
      },
    });
  }
}

export async function syncPricingCatalog() {
  await ensurePricingBootstrap();

  const finishes = await prisma.productFinish.findMany({
    where: { name: { in: INITIAL_FINISHES.map((finish) => finish.name) }, active: true },
    select: { id: true },
  });
  const finishIds = finishes.map((finish) => finish.id);

  for (const product of INITIAL_PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { name: product.name },
      select: { id: true },
    });

    const normalized = normalizeProductPayload(product, finishIds);

    if (!existing) {
      await prisma.product.create({
        data: {
          name: normalized.name,
          description: normalized.description,
          category: normalized.category,
          premiumCategory: normalized.premiumCategory,
          legacyProdutoTipo: normalized.legacyProdutoTipo,
          isOutsourced: normalized.isOutsourced,
          supplierCost: normalized.supplierCost,
          pricingMode: normalized.pricingMode,
          fixedUnitPrice: normalized.fixedUnitPrice,
          urgencyEnabled: normalized.urgencyEnabled,
          active: normalized.active,
          sortOrder: normalized.sortOrder,
          pricingTiers: { create: normalized.pricingTiers },
          sizeVariations: { create: normalized.sizeVariations },
          finishLinks: { create: normalized.finishIds.map((finishId) => ({ finishId })) },
        },
      });
      continue;
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.pricingTier.deleteMany({ where: { productId: existing.id } });
      await transaction.productSizeVariation.deleteMany({ where: { productId: existing.id } });
      await transaction.productFinishProduct.deleteMany({ where: { productId: existing.id } });

      await transaction.product.update({
        where: { id: existing.id },
        data: {
          description: normalized.description,
          category: normalized.category,
          premiumCategory: normalized.premiumCategory,
          legacyProdutoTipo: normalized.legacyProdutoTipo,
          isOutsourced: normalized.isOutsourced,
          supplierCost: normalized.supplierCost,
          pricingMode: normalized.pricingMode,
          fixedUnitPrice: normalized.fixedUnitPrice,
          urgencyEnabled: normalized.urgencyEnabled,
          active: normalized.active,
          sortOrder: normalized.sortOrder,
          pricingTiers: { create: normalized.pricingTiers },
          sizeVariations: { create: normalized.sizeVariations },
          finishLinks: { create: normalized.finishIds.map((finishId) => ({ finishId })) },
        },
      });
    });
  }
}

async function getSettingsRecord() {
  await ensurePricingBootstrap();

  return prisma.pricingSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      outsourcedMultiplier: 2.5,
    },
  });
}

function resolveBaseUnitPrice(product: Prisma.ProductGetPayload<{ include: typeof productInclude }>, quantity: number, outsourcedMultiplier: number) {
  if (product.pricingMode === 'OUTSOURCED' || product.isOutsourced) {
    const supplierCost = product.supplierCost ?? 0;
    if (supplierCost <= 0) {
      throw Object.assign(new Error('Produto terceirizado sem custo de fornecedor configurado'), { statusCode: 400 });
    }

    return {
      unitPrice: Number((supplierCost * outsourcedMultiplier).toFixed(2)),
      matchedTier: null,
      strategy: 'outsourced' as const,
    };
  }

  if (product.pricingMode === 'FIXED') {
    const fixedUnitPrice = product.fixedUnitPrice ?? 0;
    if (fixedUnitPrice <= 0) {
      throw Object.assign(new Error('Produto fixo sem preço unitário configurado'), { statusCode: 400 });
    }

    return {
      unitPrice: Number(fixedUnitPrice.toFixed(2)),
      matchedTier: null,
      strategy: 'fixed' as const,
    };
  }

  const tier = product.pricingTiers.find((currentTier) => (
    quantity >= currentTier.minQuantity
    && (currentTier.maxQuantity === null || quantity <= currentTier.maxQuantity)
  ));

  if (!tier) {
    throw Object.assign(new Error('Nenhuma faixa de preço encontrada para a quantidade informada'), { statusCode: 400 });
  }

  return {
    unitPrice: Number(tier.unitPrice.toFixed(2)),
    matchedTier: tier,
    strategy: 'progressive' as const,
  };
}

export async function getPricingSettings() {
  const settings = await getSettingsRecord();
  return settings;
}

export async function updatePricingSettings(outsourcedMultiplier: number) {
  if (outsourcedMultiplier <= 0) {
    throw Object.assign(new Error('O multiplicador terceirizado deve ser maior que zero'), { statusCode: 400 });
  }

  return prisma.pricingSettings.upsert({
    where: { id: 'default' },
    update: {
      outsourcedMultiplier: Number(outsourcedMultiplier.toFixed(2)),
    },
    create: {
      id: 'default',
      outsourcedMultiplier: Number(outsourcedMultiplier.toFixed(2)),
    },
  });
}

export async function listProductFinishes() {
  await ensurePricingBootstrap();

  return prisma.productFinish.findMany({
    where: { active: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
}

export async function listProducts() {
  await ensurePricingBootstrap();

  const products = await prisma.product.findMany({
    include: productInclude,
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });

  return products.map(serializeProduct);
}

export async function createProduct(input: ProductInput) {
  await ensurePricingBootstrap();
  validateProductInput(input);

  const resolvedMode: PricingMode = input.isOutsourced ? 'OUTSOURCED' : input.pricingMode;
  const finishIds = [...new Set(input.finishIds ?? [])];

  const product = await prisma.product.create({
    data: {
      name: input.name.trim(),
      description: trimOrNull(input.description),
      category: input.category.trim(),
      premiumCategory: trimOrNull(input.premiumCategory),
      legacyProdutoTipo: input.legacyProdutoTipo ?? null,
      isOutsourced: resolvedMode === 'OUTSOURCED',
      supplierCost: resolvedMode === 'OUTSOURCED' ? Number((input.supplierCost ?? 0).toFixed(2)) : null,
      pricingMode: resolvedMode,
      fixedUnitPrice: resolvedMode === 'FIXED' ? Number((input.fixedUnitPrice ?? 0).toFixed(2)) : null,
      urgencyEnabled: input.urgencyEnabled ?? true,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      pricingTiers: {
        create: resolvedMode === 'PROGRESSIVE'
          ? (input.pricingTiers ?? []).map((tier) => ({
              minQuantity: tier.minQuantity,
              maxQuantity: tier.maxQuantity ?? null,
              unitPrice: Number(tier.unitPrice.toFixed(2)),
            }))
          : [],
      },
      sizeVariations: {
        create: (input.sizeVariations ?? []).map((variation, index) => ({
          name: variation.name.trim(),
          widthCm: variation.widthCm ?? null,
          heightCm: variation.heightCm ?? null,
          value: Number((variation.value ?? 0).toFixed(2)),
          pricingType: variation.pricingType ?? 'FIXED',
          sortOrder: variation.sortOrder ?? index,
        })),
      },
      finishLinks: {
        create: finishIds.map((finishId) => ({ finishId })),
      },
    },
    include: productInclude,
  });

  return serializeProduct(product);
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  await ensurePricingBootstrap();

  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });

  if (!existing) {
    throw Object.assign(new Error('Produto não encontrado'), { statusCode: 404 });
  }

  const merged: ProductInput = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description ?? undefined,
    category: input.category ?? existing.category,
    premiumCategory: input.premiumCategory ?? existing.premiumCategory ?? undefined,
    legacyProdutoTipo: input.legacyProdutoTipo === undefined ? existing.legacyProdutoTipo : input.legacyProdutoTipo,
    isOutsourced: input.isOutsourced ?? existing.isOutsourced,
    supplierCost: input.supplierCost === undefined ? existing.supplierCost : input.supplierCost,
    pricingMode: input.pricingMode ?? existing.pricingMode,
    fixedUnitPrice: input.fixedUnitPrice === undefined ? existing.fixedUnitPrice : input.fixedUnitPrice,
    urgencyEnabled: input.urgencyEnabled ?? existing.urgencyEnabled,
    active: input.active ?? existing.active,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    pricingTiers: input.pricingTiers ?? existing.pricingTiers.map((tier) => ({
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      unitPrice: tier.unitPrice,
    })),
    sizeVariations: input.sizeVariations ?? existing.sizeVariations.map((variation) => ({
      name: variation.name,
      widthCm: variation.widthCm,
      heightCm: variation.heightCm,
      value: variation.value,
      pricingType: variation.pricingType,
      sortOrder: variation.sortOrder,
    })),
    finishIds: input.finishIds ?? existing.finishLinks.map((link) => link.finishId),
  };

  validateProductInput(merged);

  const resolvedMode: PricingMode = merged.isOutsourced ? 'OUTSOURCED' : merged.pricingMode;
  const finishIds = [...new Set(merged.finishIds ?? [])];

  const product = await prisma.$transaction(async (transaction) => {
    await transaction.pricingTier.deleteMany({ where: { productId: id } });
    await transaction.productSizeVariation.deleteMany({ where: { productId: id } });
    await transaction.productFinishProduct.deleteMany({ where: { productId: id } });

    return transaction.product.update({
      where: { id },
      data: {
        name: merged.name.trim(),
        description: trimOrNull(merged.description),
        category: merged.category.trim(),
        premiumCategory: trimOrNull(merged.premiumCategory),
        legacyProdutoTipo: merged.legacyProdutoTipo ?? null,
        isOutsourced: resolvedMode === 'OUTSOURCED',
        supplierCost: resolvedMode === 'OUTSOURCED' ? Number((merged.supplierCost ?? 0).toFixed(2)) : null,
        pricingMode: resolvedMode,
        fixedUnitPrice: resolvedMode === 'FIXED' ? Number((merged.fixedUnitPrice ?? 0).toFixed(2)) : null,
        urgencyEnabled: merged.urgencyEnabled ?? true,
        active: merged.active ?? true,
        sortOrder: merged.sortOrder ?? 0,
        pricingTiers: {
          create: resolvedMode === 'PROGRESSIVE'
            ? (merged.pricingTiers ?? []).map((tier) => ({
                minQuantity: tier.minQuantity,
                maxQuantity: tier.maxQuantity ?? null,
                unitPrice: Number(tier.unitPrice.toFixed(2)),
              }))
            : [],
        },
        sizeVariations: {
          create: (merged.sizeVariations ?? []).map((variation, index) => ({
            name: variation.name.trim(),
            widthCm: variation.widthCm ?? null,
            heightCm: variation.heightCm ?? null,
            value: Number((variation.value ?? 0).toFixed(2)),
            pricingType: variation.pricingType ?? 'FIXED',
            sortOrder: variation.sortOrder ?? index,
          })),
        },
        finishLinks: {
          create: finishIds.map((finishId) => ({ finishId })),
        },
      },
      include: productInclude,
    });
  });

  return serializeProduct(product);
}

export async function previewPricing(input: PreviewPricingInput) {
  await ensurePricingBootstrap();

  const settings = await getSettingsRecord();
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: productInclude,
  });

  if (!product || !product.active) {
    throw Object.assign(new Error('Produto não encontrado ou inativo'), { statusCode: 404 });
  }

  const { unitPrice, matchedTier, strategy } = resolveBaseUnitPrice(product, input.quantity, settings.outsourcedMultiplier);
  const hasCustomArea = isAreaPricedProduct(product) && (input.customWidthMeters ?? 0) > 0 && (input.customHeightMeters ?? 0) > 0;
  const areaSquareMeters = hasCustomArea
    ? Number(((input.customWidthMeters ?? 0) * (input.customHeightMeters ?? 0)).toFixed(4))
    : null;
  const areaUnitPrice = hasCustomArea
    ? Number((((product.fixedUnitPrice ?? 0) * (areaSquareMeters ?? 0))).toFixed(2))
    : unitPrice;
  const baseSubtotal = Number((areaUnitPrice * input.quantity).toFixed(2));

  const selectedVariation = input.sizeVariationId
    ? product.sizeVariations.find((variation) => variation.id === input.sizeVariationId) ?? null
    : null;

  const sizeVariationAmount = selectedVariation
    ? Number((selectedVariation.pricingType === 'PERCENTAGE'
      ? baseSubtotal * (selectedVariation.value / 100)
      : selectedVariation.value * input.quantity).toFixed(2))
    : 0;

  const subtotalBeforeFinishes = Number((baseSubtotal + sizeVariationAmount).toFixed(2));
  const requestedFinishIds = new Set(input.finishIds ?? []);
  const selectedFinishes = product.finishLinks
    .map((link) => link.finish)
    .filter((finish) => requestedFinishIds.has(finish.id));

  const finishBreakdown = selectedFinishes.map((finish) => {
    const amount = finish.pricingType === 'PERCENTAGE'
      ? subtotalBeforeFinishes * (finish.value / 100)
      : finish.value;

    return {
      id: finish.id,
      name: finish.name,
      pricingType: finish.pricingType,
      value: finish.value,
      amount: Number(amount.toFixed(2)),
    };
  });

  const finishesAmount = Number(finishBreakdown.reduce((sum, finish) => sum + finish.amount, 0).toFixed(2));
  const artCreationAmount = Number(resolveArtCreationAmount(product, input.includeArtCreation).toFixed(2));
  const subtotalWithFinishes = Number((subtotalBeforeFinishes + finishesAmount + artCreationAmount).toFixed(2));

  const urgencyMap = {
    NONE: 0,
    PRIORITARIO: 20,
    EXPRESS: 30,
  } as const;

  const urgencyPercentage = product.urgencyEnabled ? urgencyMap[input.urgency ?? 'NONE'] : 0;
  const urgencyAmount = Number((subtotalWithFinishes * (urgencyPercentage / 100)).toFixed(2));
  const total = Number((subtotalWithFinishes + urgencyAmount).toFixed(2));

  return {
    product: serializeProduct(product),
    settings,
    quantity: input.quantity,
    pricingStrategy: strategy,
    baseUnitPrice: areaUnitPrice,
    baseSubtotal,
    matchedTier: matchedTier
      ? {
          id: matchedTier.id,
          minQuantity: matchedTier.minQuantity,
          maxQuantity: matchedTier.maxQuantity,
          unitPrice: matchedTier.unitPrice,
        }
      : null,
    selectedSizeVariation: selectedVariation
      ? {
          id: selectedVariation.id,
          name: selectedVariation.name,
          pricingType: selectedVariation.pricingType,
          value: selectedVariation.value,
          amount: sizeVariationAmount,
        }
      : null,
    selectedFinishes: finishBreakdown,
    finishesAmount,
    artCreationAmount,
    subtotalBeforeUrgency: subtotalWithFinishes,
    urgency: {
      level: input.urgency ?? 'NONE',
      percentage: urgencyPercentage,
      amount: urgencyAmount,
      enabled: product.urgencyEnabled,
    },
    outsourcedMultiplier: settings.outsourcedMultiplier,
    customDimensions: hasCustomArea
      ? {
          widthMeters: input.customWidthMeters ?? 0,
          heightMeters: input.customHeightMeters ?? 0,
          areaSquareMeters: areaSquareMeters ?? 0,
          pricePerSquareMeter: product.fixedUnitPrice ?? 0,
        }
      : null,
    total,
  };
}
