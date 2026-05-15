import type { ModifierType, PricingSettings, PricingUrgency, PricingMode, ProductFinish } from '@/types';

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  PROGRESSIVE: 'Progressivo',
  FIXED: 'Fixo',
  OUTSOURCED: 'Terceirizado',
};

export const MODIFIER_TYPE_LABELS: Record<ModifierType, string> = {
  FIXED: 'Valor fixo',
  PERCENTAGE: 'Percentual',
};

export const URGENCY_LABELS: Record<PricingUrgency, string> = {
  NONE: 'Padrão',
  PRIORITARIO: 'Prioritário +20%',
  EXPRESS: 'Express +30%',
};

export interface PricingPreviewFinish {
  id: string;
  name: string;
  value: number;
  pricingType: ModifierType;
}

export interface PricingPreviewTier {
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
}

export interface PricingPreviewSizeVariation {
  id: string;
  name: string;
  value: number;
  pricingType: ModifierType;
  widthCm?: number | null;
  heightCm?: number | null;
}

export interface PricingPreviewProductSource {
  name?: string;
  pricingMode: PricingMode;
  isOutsourced: boolean;
  supplierCost?: number | null;
  fixedUnitPrice?: number | null;
  urgencyEnabled: boolean;
  pricingTiers: PricingPreviewTier[];
  sizeVariations: PricingPreviewSizeVariation[];
  availableFinishes: PricingPreviewFinish[];
}

export interface PricingPreviewComputationInput {
  product: PricingPreviewProductSource;
  settings: Pick<PricingSettings, 'outsourcedMultiplier'>;
  quantity: number;
  finishIds: string[];
  sizeVariationId?: string;
  customWidthMeters?: number;
  customHeightMeters?: number;
  includeArtCreation?: boolean;
  urgency: PricingUrgency;
}

export function formatPricingCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function supportsArtCreation(product: PricingPreviewProductSource) {
  return /banner|flyer/i.test(product.name ?? '') || product.isOutsourced && /cartão|pvc/i.test(product.name ?? '');
}

function resolveArtCreationAmount(product: PricingPreviewProductSource, includeArtCreation?: boolean) {
  if (!includeArtCreation || !supportsArtCreation(product)) {
    return 0;
  }

  return /cartão|pvc/i.test(product.name ?? '') ? 120 : 60;
}

export function findMatchedTier(tiers: PricingPreviewTier[], quantity: number) {
  return [...tiers]
    .sort((first, second) => first.minQuantity - second.minQuantity)
    .find((tier) => quantity >= tier.minQuantity && (tier.maxQuantity == null || quantity <= tier.maxQuantity)) ?? null;
}

export function calculatePricingPreview(input: PricingPreviewComputationInput) {
  const { product, settings, quantity, finishIds, sizeVariationId, customWidthMeters, customHeightMeters, includeArtCreation, urgency } = input;

  const matchedTier = product.pricingMode === 'PROGRESSIVE'
    ? findMatchedTier(product.pricingTiers, quantity)
    : null;

  const isAreaPriced = /banner/i.test(product.name ?? '');

  const baseUnitPrice = product.pricingMode === 'OUTSOURCED' || product.isOutsourced
    ? roundMoney((product.supplierCost ?? 0) * settings.outsourcedMultiplier)
    : product.pricingMode === 'FIXED'
      ? roundMoney(product.fixedUnitPrice ?? 0)
      : roundMoney(matchedTier?.unitPrice ?? 0);

  const areaSquareMeters = isAreaPriced && (customWidthMeters ?? 0) > 0 && (customHeightMeters ?? 0) > 0
    ? Number(((customWidthMeters ?? 0) * (customHeightMeters ?? 0)).toFixed(4))
    : null;
  const unitPrice = areaSquareMeters !== null ? roundMoney((product.fixedUnitPrice ?? 0) * areaSquareMeters) : baseUnitPrice;

  const baseSubtotal = roundMoney(unitPrice * quantity);
  const selectedSizeVariation = sizeVariationId
    ? product.sizeVariations.find((variation) => variation.id === sizeVariationId) ?? null
    : null;

  const sizeVariationAmount = selectedSizeVariation
    ? roundMoney(selectedSizeVariation.pricingType === 'PERCENTAGE'
      ? baseSubtotal * (selectedSizeVariation.value / 100)
      : selectedSizeVariation.value * quantity)
    : 0;

  const subtotalBeforeFinishes = roundMoney(baseSubtotal + sizeVariationAmount);
  const selectedFinishes = product.availableFinishes.filter((finish) => finishIds.includes(finish.id));

  const finishBreakdown = selectedFinishes.map((finish) => ({
    ...finish,
    amount: roundMoney(finish.pricingType === 'PERCENTAGE'
      ? subtotalBeforeFinishes * (finish.value / 100)
      : finish.value),
  }));

  const finishesAmount = roundMoney(finishBreakdown.reduce((sum, finish) => sum + finish.amount, 0));
  const artCreationAmount = roundMoney(resolveArtCreationAmount(product, includeArtCreation));
  const subtotalBeforeUrgency = roundMoney(subtotalBeforeFinishes + finishesAmount + artCreationAmount);
  const urgencyPercentage = !product.urgencyEnabled
    ? 0
    : urgency === 'PRIORITARIO'
      ? 20
      : urgency === 'EXPRESS'
        ? 30
        : 0;
  const urgencyAmount = roundMoney(subtotalBeforeUrgency * (urgencyPercentage / 100));
  const total = roundMoney(subtotalBeforeUrgency + urgencyAmount);

  return {
    baseUnitPrice: unitPrice,
    baseSubtotal,
    matchedTier,
    selectedSizeVariation,
    sizeVariationAmount,
    selectedFinishes: finishBreakdown,
    finishesAmount,
    artCreationAmount,
    subtotalBeforeUrgency,
    urgencyPercentage,
    urgencyAmount,
    customDimensions: areaSquareMeters !== null
      ? {
          widthMeters: customWidthMeters ?? 0,
          heightMeters: customHeightMeters ?? 0,
          areaSquareMeters,
          pricePerSquareMeter: product.fixedUnitPrice ?? 0,
        }
      : null,
    total,
  };
}

export function buildFinishLookup(finishes: ProductFinish[]) {
  return new Map(finishes.map((finish) => [finish.id, finish]));
}
