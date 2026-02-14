import { prisma } from '../prisma/client';

/**
 * Retorna a data de hoje no formato Date (início do dia, sem horário)
 * para uso no campo @db.Date do Prisma
 */
function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Busca todos os pontos (ADMIN) ou apenas do usuário (EMPLOYEE) */
export async function listPontos(userId: string, role: string) {
  const where = role === 'ADMIN' ? {} : { userId };

  return prisma.ponto.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
    },
    orderBy: { date: 'desc' },
  });
}

/** Busca o ponto de hoje do usuário logado */
export async function getPontoHoje(userId: string) {
  const today = getToday();

  let ponto = await prisma.ponto.findUnique({
    where: {
      userId_date: { userId, date: today },
    },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
    },
  });

  // Se não existe ponto para hoje, retorna null (ainda não bateu)
  return ponto;
}

/**
 * Registra a próxima batida de ponto automaticamente.
 * Ordem: entrada → almoço → retorno → saída
 */
export async function baterPonto(userId: string) {
  const today = getToday();
  const agora = new Date();

  // Busca ou cria o ponto do dia
  let ponto = await prisma.ponto.findUnique({
    where: {
      userId_date: { userId, date: today },
    },
  });

  if (!ponto) {
    // Primeiro registro do dia: criar ponto com entrada
    ponto = await prisma.ponto.create({
      data: {
        userId,
        date: today,
        entrada: agora,
      },
    });

    return getPontoComUser(ponto.id);
  }

  // Lógica de batida automática sequencial
  if (ponto.entrada === null) {
    // Registrar entrada
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { entrada: agora },
    });
  } else if (ponto.almoco === null) {
    // Registrar saída para almoço
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { almoco: agora },
    });
  } else if (ponto.retorno === null) {
    // Registrar retorno do almoço
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { retorno: agora },
    });
  } else if (ponto.saida === null) {
    // Registrar saída final
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { saida: agora },
    });
  } else {
    // Jornada já encerrada
    throw Object.assign(new Error('Jornada do dia já encerrada'), { statusCode: 400 });
  }

  return getPontoComUser(ponto.id);
}

/** Busca ponto com dados do usuário */
async function getPontoComUser(pontoId: string) {
  return prisma.ponto.findUnique({
    where: { id: pontoId },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
    },
  });
}

/**
 * Calcula as horas trabalhadas.
 * Fórmula: (saída - entrada) - (retorno - almoço)
 * Retorna formato "Xh Ym"
 */
export function calcularHoras(ponto: {
  entrada: Date | null;
  almoco: Date | null;
  retorno: Date | null;
  saida: Date | null;
}): string | null {
  if (!ponto.entrada || !ponto.saida) return null;

  let totalMs = ponto.saida.getTime() - ponto.entrada.getTime();

  // Desconta tempo de almoço se ambos existem
  if (ponto.almoco && ponto.retorno) {
    const almocoMs = ponto.retorno.getTime() - ponto.almoco.getTime();
    totalMs -= almocoMs;
  }

  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h${minutes.toString().padStart(2, '0')}m`;
}

/** Relatório de pontos com filtro por período e usuário */
export async function getRelatorio(params: {
  userId?: string;
  startDate: string;
  endDate: string;
  requestUserId: string;
  requestUserRole: string;
}) {
  const { userId, startDate, endDate, requestUserId, requestUserRole } = params;

  // EMPLOYEE só pode ver seus próprios dados
  const filterUserId = requestUserRole === 'ADMIN'
    ? (userId ?? undefined)
    : requestUserId;

  const pontos = await prisma.ponto.findMany({
    where: {
      userId: filterUserId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Adiciona cálculo de horas em cada ponto
  return pontos.map((ponto) => ({
    ...ponto,
    horasTrabalhadas: calcularHoras(ponto),
  }));
}
