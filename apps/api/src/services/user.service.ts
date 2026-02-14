import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: 'ADMIN' | 'EMPLOYEE';
  avatarColor?: string;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'EMPLOYEE';
  avatarColor?: string;
  active?: boolean;
}

/** Gera as iniciais a partir do nome */
function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0]!.substring(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Lista todos os funcionários (ativos e inativos) */
export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      initials: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });
}

/** Cria um novo funcionário */
export async function createUser(data: CreateUserInput) {
  const hashedPassword = await bcrypt.hash(data.password, 12);
  const initials = getInitials(data.name);

  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role ?? 'EMPLOYEE',
      avatarColor: data.avatarColor ?? '#6c63ff',
      initials,
    },
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
}

/** Atualiza um funcionário */
export async function updateUser(id: string, data: UpdateUserInput) {
  const updateData: Record<string, unknown> = {};

  if (data.name) {
    updateData.name = data.name;
    updateData.initials = getInitials(data.name);
  }
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.avatarColor) updateData.avatarColor = data.avatarColor;
  if (data.active !== undefined) updateData.active = data.active;

  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      initials: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** Desativa um funcionário (soft delete) */
export async function deleteUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { active: false },
    select: {
      id: true,
      name: true,
      active: true,
    },
  });
}
