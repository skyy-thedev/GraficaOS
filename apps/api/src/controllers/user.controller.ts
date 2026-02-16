import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as userService from '../services/user.service';

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  avatarColor: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional(),
  avatarColor: z.string().optional(),
  active: z.boolean().optional(),
});

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await userService.listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await userService.createUser(body);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id!, body);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.deleteUser(req.params.id!);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function hardRemove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.hardDeleteUser(req.params.id!);
    res.json(user);
  } catch (error) {
    next(error);
  }
}
