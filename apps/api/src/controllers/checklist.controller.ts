import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as checklistService from '../services/checklist.service';

// ===== Schemas de validação =====

const criarItemSchema = z.object({
  titulo: z.string().min(2).max(100),
  descricao: z.string().max(300).optional(),
  horarioLimite: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  ordem: z.number().int().min(0).optional(),
});

const editarItemSchema = z.object({
  titulo: z.string().min(2).max(100).optional(),
  descricao: z.string().max(300).optional(),
  horarioLimite: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  ordem: z.number().int().min(0).optional(),
});

const relatorioQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ===== Controllers =====

/** GET /api/checklist/itens — Lista todos os itens */
export async function listarItens(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const itens = await checklistService.listarItens(req.userRole!);
    res.json(itens);
  } catch (error) {
    next(error);
  }
}

/** POST /api/checklist/itens — Cria item (ADMIN) */
export async function criarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    const data = criarItemSchema.parse(req.body);
    const item = await checklistService.criarItem(data);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

/** PUT /api/checklist/itens/:id — Edita item (ADMIN) */
export async function editarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    const data = editarItemSchema.parse(req.body);
    const item = await checklistService.editarItem(req.params.id as string, data);
    res.json(item);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/checklist/itens/:id/toggle — Ativa/desativa item (ADMIN) */
export async function toggleItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    const item = await checklistService.toggleAtivoItem(req.params.id as string);
    res.json(item);
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/checklist/itens/:id — Remove item permanentemente (ADMIN) */
export async function deletarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    await checklistService.deletarItem(req.params.id as string);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

/** GET /api/checklist/hoje — Retorna itens do dia com status de conclusão */
export async function checklistHoje(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const itens = await checklistService.getChecklistHoje();
    res.json(itens);
  } catch (error) {
    next(error);
  }
}

/** POST /api/checklist/marcar/:itemId — Marca/desmarca item */
export async function marcarItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const itens = await checklistService.marcarItem(req.params.itemId as string, req.userId!);
    res.json(itens);
  } catch (error) {
    next(error);
  }
}

/** GET /api/checklist/relatorio — Relatório de cumprimento (ADMIN) */
export async function relatorio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    const query = relatorioQuerySchema.parse(req.query);
    const resultado = await checklistService.getRelatorio(query.startDate, query.endDate);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
}
