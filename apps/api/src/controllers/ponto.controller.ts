import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as pontoService from '../services/ponto.service';

const relatorioSchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().min(1, 'Data inicial é obrigatória'),
  endDate: z.string().min(1, 'Data final é obrigatória'),
});

const emailSchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  destinatario: z.string().email('Email inválido'),
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

export async function metricas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = relatorioSchema.parse(req.query);
    const result = await pontoService.getMetricas({
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
      requestUserId: req.userId!,
      requestUserRole: req.userRole!,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function exportCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = relatorioSchema.parse(req.query);
    const csv = await pontoService.exportCSV({
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pontos-${query.startDate}-${query.endDate}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function exportXLSX(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = relatorioSchema.parse(req.query);
    const buffer = await pontoService.exportXLSX({
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="pontos-${query.startDate}-${query.endDate}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function exportPDF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = relatorioSchema.parse(req.query);
    const buffer = await pontoService.exportPDF({
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pontos-${query.startDate}-${query.endDate}.pdf"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function enviarEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = emailSchema.parse(req.body);
    const result = await pontoService.enviarRelatorioPorEmail(body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
