import { prisma } from '../prisma/client';

// ===== Helpers =====

function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isAtrasado(horarioLimite: string | null, feito: boolean): boolean {
  if (!horarioLimite || feito) return false;
  const now = new Date();
  const [h, m] = horarioLimite.split(':').map(Number);
  const limite = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  return now > limite;
}

function isNoHorario(feitoEm: Date | null, horarioLimite: string | null): boolean {
  if (!feitoEm || !horarioLimite) return false;
  const [h, m] = horarioLimite.split(':').map(Number);
  const limite = new Date(feitoEm.getFullYear(), feitoEm.getMonth(), feitoEm.getDate(), h, m);
  return feitoEm <= limite;
}

// ===== Itens (ADMIN) =====

export async function listarItens(role: string) {
  // Admin vê todos; employee vê apenas ativos
  const where = role === 'ADMIN' ? {} : { ativo: true };
  return prisma.checklistItem.findMany({
    where,
    orderBy: { ordem: 'asc' },
  });
}

export async function criarItem(data: {
  titulo: string;
  descricao?: string;
  horarioLimite?: string;
  ordem?: number;
}) {
  // Se ordem não especificada, coloca no final
  if (data.ordem === undefined) {
    const ultimo = await prisma.checklistItem.findFirst({
      orderBy: { ordem: 'desc' },
    });
    data.ordem = (ultimo?.ordem ?? 0) + 1;
  }

  return prisma.checklistItem.create({ data });
}

export async function editarItem(
  id: string,
  data: {
    titulo?: string;
    descricao?: string;
    horarioLimite?: string;
    ordem?: number;
  },
) {
  return prisma.checklistItem.update({
    where: { id },
    data,
  });
}

export async function toggleAtivoItem(id: string) {
  const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id } });
  return prisma.checklistItem.update({
    where: { id },
    data: { ativo: !item.ativo },
  });
}

export async function deletarItem(id: string) {
  return prisma.checklistItem.delete({ where: { id } });
}

// ===== Registros do dia =====

export async function getChecklistHoje() {
  const today = getToday();

  // 1. Buscar itens ativos ordenados
  const itens = await prisma.checklistItem.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  // 2. Buscar registros de hoje
  const registros = await prisma.checklistRegistro.findMany({
    where: { data: today },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
    },
  });

  // 3. Mapear itens com status
  const registroMap = new Map(registros.map((r) => [r.itemId, r]));

  return itens.map((item) => {
    const reg = registroMap.get(item.id);
    const feito = reg?.feito ?? false;
    const feitoEm = reg?.feitoEm ?? null;
    const feitoPor = feito && reg?.user ? reg.user : null;
    const atrasado = isAtrasado(item.horarioLimite, feito);

    return {
      id: item.id,
      titulo: item.titulo,
      descricao: item.descricao,
      horarioLimite: item.horarioLimite,
      ordem: item.ordem,
      ativo: item.ativo,
      feito,
      feitoEm: feitoEm?.toISOString() ?? null,
      feitoPor,
      atrasado,
    };
  });
}

export async function marcarItem(itemId: string, userId: string) {
  const today = getToday();

  // Verificar se item existe
  await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });

  // Buscar registro existente
  const existente = await prisma.checklistRegistro.findUnique({
    where: { itemId_data: { itemId, data: today } },
  });

  if (existente) {
    // Toggle
    const novoFeito = !existente.feito;
    await prisma.checklistRegistro.update({
      where: { id: existente.id },
      data: {
        feito: novoFeito,
        feitoEm: novoFeito ? new Date() : null,
        userId: novoFeito ? userId : existente.userId,
      },
    });
  } else {
    // Criar novo com feito = true
    await prisma.checklistRegistro.create({
      data: {
        itemId,
        userId,
        data: today,
        feito: true,
        feitoEm: new Date(),
      },
    });
  }

  // Retornar o checklist atualizado do dia
  return getChecklistHoje();
}

// ===== Relatório =====

export async function getRelatorio(startDate: string, endDate: string) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  // Buscar todos os registros no intervalo
  const registros = await prisma.checklistRegistro.findMany({
    where: {
      data: { gte: start, lte: end },
    },
    include: {
      item: true,
      user: { select: { name: true } },
    },
    orderBy: { data: 'asc' },
  });

  // Buscar itens ativos (para totalItens por dia)
  const itensAtivos = await prisma.checklistItem.findMany({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
  });

  // Agrupar por dia
  const diasMap = new Map<string, typeof registros>();

  // Gerar todos os dias no intervalo
  const current = new Date(start);
  while (current <= end) {
    const key = current.toISOString().slice(0, 10);
    diasMap.set(key, []);
    current.setDate(current.getDate() + 1);
  }

  // Preencher com registros
  for (const reg of registros) {
    const key = reg.data.toISOString().slice(0, 10);
    const arr = diasMap.get(key);
    if (arr) arr.push(reg);
  }

  // Montar relatório
  const resultado = Array.from(diasMap.entries()).map(([data, regs]) => {
    const totalItens = itensAtivos.length;
    const regMap = new Map(regs.map((r) => [r.itemId, r]));

    const itens = itensAtivos.map((item) => {
      const reg = regMap.get(item.id);
      const feito = reg?.feito ?? false;
      const feitoEm = reg?.feitoEm ?? null;
      const feitoPor = reg?.user?.name ?? null;
      const noHorario = isNoHorario(feitoEm, item.horarioLimite);

      return {
        titulo: item.titulo,
        feito,
        feitoEm: feitoEm?.toISOString() ?? null,
        feitoPor,
        horarioLimite: item.horarioLimite,
        noHorario,
      };
    });

    const itensConcluidos = itens.filter((i) => i.feito).length;
    const percentual = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0;

    return {
      data,
      totalItens,
      itensConcluidos,
      percentual,
      itens,
    };
  });

  return resultado;
}
