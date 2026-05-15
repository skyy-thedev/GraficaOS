import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as pricingService from '../services/pricing.service';

const produtoTipoSchema = z.enum([
  'AZULEJO',
  'BANNER',
  'ADESIVO',
  'ADESIVO_RECORTE',
  'LONA',
  'PLACA',
  'FAIXA',
  'CARTAO_VISITA',
  'PANFLETO',
  'FOLDER',
  'PERFURADO',
  'ENVELOPAMENTO',
  'BACKLIGHT',
  'OUTRO',
]);

const pricingModeSchema = z.enum(['PROGRESSIVE', 'FIXED', 'OUTSOURCED']);
const modifierTypeSchema = z.enum(['FIXED', 'PERCENTAGE']);
const urgencySchema = z.enum(['NONE', 'PRIORITARIO', 'EXPRESS']);

const pricingTierSchema = z.object({
  minQuantity: z.number().int().min(1),
  maxQuantity: z.number().int().min(1).nullable().optional(),
  unitPrice: z.number().nonnegative(),
});

const sizeVariationSchema = z.object({
  name: z.string().min(1, 'Nome da variação é obrigatório'),
  widthCm: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  value: z.number().nonnegative().optional(),
  pricingType: modifierTypeSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(2, 'Nome do produto é obrigatório'),
  description: z.string().optional(),
  category: z.string().min(2, 'Categoria é obrigatória'),
  premiumCategory: z.string().optional(),
  legacyProdutoTipo: produtoTipoSchema.nullable().optional(),
  isOutsourced: z.boolean().optional(),
  supplierCost: z.number().nonnegative().nullable().optional(),
  pricingMode: pricingModeSchema,
  fixedUnitPrice: z.number().nonnegative().nullable().optional(),
  urgencyEnabled: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  pricingTiers: z.array(pricingTierSchema).optional(),
  sizeVariations: z.array(sizeVariationSchema).optional(),
  finishIds: z.array(z.string().min(1)).optional(),
});

const updateProductSchema = createProductSchema.partial();

const updateSettingsSchema = z.object({
  outsourcedMultiplier: z.number().positive(),
});

const previewPricingSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  finishIds: z.array(z.string().min(1)).optional(),
  sizeVariationId: z.string().min(1).optional(),
  customWidthMeters: z.number().positive().optional(),
  customHeightMeters: z.number().positive().optional(),
  includeArtCreation: z.boolean().optional(),
  urgency: urgencySchema.optional(),
});

function resolveParamId(id: string | string[] | undefined) {
  return Array.isArray(id) ? id[0] : id;
}

export async function getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await pricingService.getPricingSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateSettingsSchema.parse(req.body);
    const settings = await pricingService.updatePricingSettings(body.outsourcedMultiplier);
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

export async function listFinishes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const finishes = await pricingService.listProductFinishes();
    res.json(finishes);
  } catch (error) {
    next(error);
  }
}

export async function listProducts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const products = await pricingService.listProducts();
    res.json(products);
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createProductSchema.parse(req.body);
    const product = await pricingService.createProduct(body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = resolveParamId(req.params.id);
    if (!productId) {
      res.status(400).json({ message: 'ID do produto é obrigatório' });
      return;
    }

    const body = updateProductSchema.parse(req.body);
    const product = await pricingService.updateProduct(productId, body);
    res.json(product);
  } catch (error) {
    next(error);
  }
}

export async function preview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = previewPricingSchema.parse(req.body);
    const preview = await pricingService.previewPricing(body);
    res.json(preview);
  } catch (error) {
    next(error);
  }
}
