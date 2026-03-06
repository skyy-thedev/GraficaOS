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

const editarPontoSchema = z.object({
  entrada: z.string().nullable().optional(),
  almoco: z.string().nullable().optional(),
  retorno: z.string().nullable().optional(),
  saida: z.string().nullable().optional(),
  status: z.enum(['NORMAL', 'FOLGA', 'FALTA']).optional(),
  date: z.string().optional(),
});

const pontoManualSchema = z.object({
  userId: z.string().min(1, 'Funcionário é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  entrada: z.string().nullable().optional(),
  almoco: z.string().nullable().optional(),
  retorno: z.string().nullable().optional(),
  saida: z.string().nullable().optional(),
  status: z.enum(['NORMAL', 'FOLGA', 'FALTA']).optional(),
});

const configurarFolgasSchema = z.object({
  userId: z.string().min(1),
  diasSemana: z.array(z.number().min(0).max(6)),
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

export async function anomalias(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = relatorioSchema.parse(req.query);
    const result = await pontoService.getAnomalias({
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function insights(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = relatorioSchema.parse(req.query);
    const result = await pontoService.getInsights({
      startDate: query.startDate,
      endDate: query.endDate,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function editar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const body = editarPontoSchema.parse(req.body);
    const ponto = await pontoService.editarPonto({
      pontoId: id,
      entrada: body.entrada,
      almoco: body.almoco,
      retorno: body.retorno,
      saida: body.saida,
      status: body.status,
      date: body.date,
    });
    res.json(ponto);
  } catch (error) {
    next(error);
  }
}

export async function criarManual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = pontoManualSchema.parse(req.body);
    const ponto = await pontoService.criarPontoManual({
      userId: body.userId,
      date: body.date,
      entrada: body.entrada,
      almoco: body.almoco,
      retorno: body.retorno,
      saida: body.saida,
      status: body.status,
    });
    res.status(201).json(ponto);
  } catch (error) {
    next(error);
  }
}

export async function listarFolgas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.query.userId as string | undefined;
    const folgas = await pontoService.listarFolgas(userId);
    res.json(folgas);
  } catch (error) {
    next(error);
  }
}

export async function configurarFolgas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = configurarFolgasSchema.parse(req.body);
    const folgas = await pontoService.configurarFolgas(body.userId, body.diasSemana);
    res.json(folgas);
  } catch (error) {
    next(error);
  }
}
