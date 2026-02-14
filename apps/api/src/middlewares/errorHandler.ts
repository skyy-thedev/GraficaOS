import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/** Middleware global de tratamento de erros */
export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  console.error('❌ Erro:', err.message);

  // Erro de validação do Prisma (registro único duplicado)
  if (err.code === 'P2002') {
    res.status(409).json({
      message: 'Registro duplicado. Este dado já existe no sistema.',
    });
    return;
  }

  // Erro de registro não encontrado do Prisma
  if (err.code === 'P2025') {
    res.status(404).json({
      message: 'Registro não encontrado.',
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message = statusCode === 500 ? 'Erro interno do servidor' : err.message;

  res.status(statusCode).json({ message });
}
