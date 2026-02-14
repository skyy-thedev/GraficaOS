import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as arteService from '../services/arte.service';

const createArteSchema = z.object({
  clienteNome: z.string().min(1, 'Nome do cliente é obrigatório'),
  clienteNumero: z.string().min(1, 'Número do cliente é obrigatório'),
  orcamentoNum: z.string().min(1, 'Número do orçamento é obrigatório'),
  produto: z.enum(['AZULEJO', 'BANNER', 'ADESIVO', 'PLACA', 'FAIXA', 'OUTRO']),
  quantidade: z.number().int().min(1).optional(),
  largura: z.number().positive('Largura deve ser positiva'),
  altura: z.number().positive('Altura deve ser positiva'),
  responsavelId: z.string().min(1, 'Responsável é obrigatório'),
  urgencia: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  prazo: z.string().optional(),
  observacoes: z.string().optional(),
});

const updateArteSchema = z.object({
  clienteNome: z.string().min(1).optional(),
  clienteNumero: z.string().min(1).optional(),
  orcamentoNum: z.string().min(1).optional(),
  produto: z.enum(['AZULEJO', 'BANNER', 'ADESIVO', 'PLACA', 'FAIXA', 'OUTRO']).optional(),
  quantidade: z.number().int().min(1).optional(),
  largura: z.number().positive().optional(),
  altura: z.number().positive().optional(),
  responsavelId: z.string().min(1).optional(),
  urgencia: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  prazo: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

const statusSchema = z.object({
  status: z.enum(['TODO', 'DOING', 'REVIEW', 'DONE']),
});

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const artes = await arteService.listArtes(req.userId!, req.userRole!);
    res.json(artes);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createArteSchema.parse(req.body);
    const arte = await arteService.createArte(body);
    res.status(201).json(arte);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateArteSchema.parse(req.body);
    const arte = await arteService.updateArte(req.params.id!, body);
    res.json(arte);
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = statusSchema.parse(req.body);
    const arte = await arteService.updateArteStatus(req.params.id!, body.status);
    res.json(arte);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await arteService.deleteArte(req.params.id!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function uploadArquivos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ message: 'Nenhum arquivo enviado' });
      return;
    }

    const arte = await arteService.addArquivos(req.params.id!, files);
    res.json(arte);
  } catch (error) {
    next(error);
  }
}

export async function deleteArquivo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await arteService.deleteArquivo(req.params.id!, req.params.arquivoId!);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
