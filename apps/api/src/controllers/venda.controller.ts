import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as vendaService from '../services/venda.service';

const produtoTipoSchema = z.enum(['AZULEJO', 'BANNER', 'ADESIVO', 'ADESIVO_RECORTE', 'LONA', 'PLACA', 'FAIXA', 'CARTAO_VISITA', 'PANFLETO', 'FOLDER', 'PERFURADO', 'ENVELOPAMENTO', 'BACKLIGHT', 'OUTRO']);
const formaPagamentoSchema = z.enum(['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'OUTRO']);
const vendaStatusSchema = z.enum(['AGUARDANDO', 'CONCLUIDA']);
const pricingUrgencySchema = z.enum(['NONE', 'PRIORITARIO', 'EXPRESS']);

const createVendaSchema = z.object({
  clienteNome: z.string().optional(),
  clienteDocumento: z.string().optional(),
  clienteTelefone: z.string().optional(),
  pricingProductId: z.string().min(1, 'Produto premium é obrigatório'),
  quantidade: z.number().int().min(1),
  finishIds: z.array(z.string().min(1)).optional(),
  sizeVariationId: z.string().min(1).optional(),
  customWidthMeters: z.number().positive().optional(),
  customHeightMeters: z.number().positive().optional(),
  includeArtCreation: z.boolean().optional(),
  descontoPercent: z.number().min(0).max(30).optional(),
  urgencia: pricingUrgencySchema.optional(),
  status: vendaStatusSchema,
  formaPagamento: formaPagamentoSchema.optional(),
  observacoes: z.string().optional(),
});

const updateVendaSchema = z.object({
  clienteNome: z.string().nullable().optional(),
  clienteDocumento: z.string().nullable().optional(),
  status: vendaStatusSchema.optional(),
  formaPagamento: formaPagamentoSchema.nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vendas = await vendaService.listVendas(req.userId!, req.userRole!);
    res.json(vendas);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createVendaSchema.parse(req.body);
    const venda = await vendaService.createVenda(req.userId!, body);
    res.status(201).json(venda);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateVendaSchema.parse(req.body);
    const vendaId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!vendaId) {
      res.status(400).json({ message: 'ID da venda é obrigatório' });
      return;
    }

    const venda = await vendaService.updateVenda(vendaId, req.userId!, req.userRole!, body);
    res.json(venda);
  } catch (error) {
    next(error);
  }
}
