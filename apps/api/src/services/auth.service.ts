import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client';
import { env } from '../config/env';
import type { JwtPayload } from '../middlewares/auth';

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarColor: string;
    initials: string;
  };
}

/** Gera o access token JWT */
function generateToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  });
}

/** Gera o refresh token JWT */
function generateRefreshToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as string,
  });
}

/** Realiza login do usuário */
export async function login({ email, password }: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.active) {
    throw Object.assign(new Error('Email ou senha inválidos'), { statusCode: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw Object.assign(new Error('Email ou senha inválidos'), { statusCode: 401 });
  }

  const token = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, user.role);

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarColor: user.avatarColor,
      initials: user.initials,
    },
  };
}

/** Atualiza o token usando refresh token */
export async function refreshAccessToken(refreshToken: string): Promise<{ token: string }> {
  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, active: true },
    });

    if (!user || !user.active) {
      throw Object.assign(new Error('Usuário inativo'), { statusCode: 401 });
    }

    const token = generateToken(user.id, user.role);
    return { token };
  } catch {
    throw Object.assign(new Error('Refresh token inválido'), { statusCode: 401 });
  }
}

/** Retorna os dados do usuário logado */
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      initials: true,
      active: true,
      createdAt: true,
    },
  });

  if (!user || !user.active) {
    throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
  }

  return user;
}
