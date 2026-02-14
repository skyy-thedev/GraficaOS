import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as pontoService from '../services/ponto.service';

const relatorioSchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().min(1, 'Data inicial é obrigatória'),
  endDate: z.string().min(1, 'Data final é obrigatória'),
});

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pontos = await pontoService.listPontos(req.userId!, req.userRole!);
    res.json(pontos);
  } catch (error) {
    next(error);
  }
}

export async function hoje(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ponto = await pontoService.getPontoHoje(req.userId!);
    res.json(ponto);
  } catch (error) {
    next(error);
  }
}

export async function bater(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ponto = await pontoService.baterPonto(req.userId!);
    res.json(ponto);
  } catch (error) {
    next(error);
  }
}

export async function relatorio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = relatorioSchema.parse(req.query);
    const pontos = await pontoService.getRelatorio({
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
      requestUserId: req.userId!,
      requestUserRole: req.userRole!,
    });
    res.json(pontos);
  } catch (error) {
    next(error);
  }
}
