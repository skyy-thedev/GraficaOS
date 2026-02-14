import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../prisma/client';

// Estende o tipo Request para incluir o usuário autenticado
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: 'ADMIN' | 'EMPLOYEE';
    }
  }
}

export interface JwtPayload {
  sub: string;
  role: 'ADMIN' | 'EMPLOYEE';
}

/** Middleware que valida o JWT e injeta userId e userRole no request */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token não fornecido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Token inválido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Verifica se o usuário ainda existe e está ativo
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, active: true },
    });

    if (!user || !user.active) {
      res.status(401).json({ message: 'Usuário inativo ou não encontrado' });
      return;
    }

    req.userId = decoded.sub;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado' });
    return;
  }
}

/** Middleware que verifica se o usuário é ADMIN */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ message: 'Acesso restrito a administradores' });
    return;
  }
  next();
}
