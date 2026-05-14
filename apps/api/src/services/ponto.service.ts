import { prisma } from '../prisma/client';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateTime } from 'luxon';
import {
  getHojeEmSaoPaulo,
  getAgoraEmSaoPaulo,
  formatarDataBR,
  formatarHoraBR,
  formatarDataHoraBR,
  toSaoPaulo,
  getHoraMinutoSP,
  parseDateOnly,
  formatarDateOnlyBR,
  formatarDateOnlyCurtaBR,
} from '../utils/timezone';

// As funções de timezone agora vêm de ../utils/timezone.ts
// getBrazilNow → getAgoraEmSaoPaulo().toJSDate()
// getToday → getHojeEmSaoPaulo()

/** Busca todos os pontos (ADMIN) ou apenas do usuário (EMPLOYEE) */
export async function listPontos(userId: string, role: string) {
  const where = role === 'ADMIN' ? {} : { userId };

  return prisma.ponto.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true },
      },
    },
    orderBy: { date: 'desc' },
  });
}

/** Busca o ponto de hoje do usuário logado */
export async function getPontoHoje(userId: string) {
  const today = getHojeEmSaoPaulo();

  let ponto = await prisma.ponto.findUnique({
    where: {
      userId_date: { userId, date: today },
    },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true },
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
  const today = getHojeEmSaoPaulo();
  const agora = new Date(); // UTC — Prisma armazena em UTC

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
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true },
      },
    },
  });
}

type ComprovanteTokenPayload = {
  type: 'PONTO_COMPROVANTE';
  pontoId: string;
  userId: string;
};

function getStatusComprovante(ponto: {
  entrada: Date | null;
  saida: Date | null;
  status: 'NORMAL' | 'FOLGA' | 'FALTA';
}) {
  if (ponto.status) {
    return ponto.status;
  }

  if (ponto.entrada || ponto.saida) {
    return 'NORMAL' as const;
  }

  return 'FALTA' as const;
}

async function getPontoComprovanteById(pontoId: string) {
  return prisma.ponto.findUnique({
    where: { id: pontoId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          loja: true,
          role: true,
        },
      },
    },
  });
}

export async function gerarTokenComprovante(params: {
  pontoId: string;
  requestUserId: string;
  requestUserRole: 'ADMIN' | 'EMPLOYEE';
}) {
  const { pontoId, requestUserId, requestUserRole } = params;

  const ponto = await prisma.ponto.findUnique({
    where: { id: pontoId },
    select: { id: true, userId: true },
  });

  if (!ponto) {
    throw Object.assign(new Error('Ponto não encontrado'), { statusCode: 404 });
  }

  if (requestUserRole !== 'ADMIN' && ponto.userId !== requestUserId) {
    throw Object.assign(new Error('Você não tem acesso a este comprovante'), { statusCode: 403 });
  }

  const token = jwt.sign(
    {
      type: 'PONTO_COMPROVANTE',
      pontoId: ponto.id,
      userId: ponto.userId,
    } satisfies ComprovanteTokenPayload,
    env.JWT_SECRET,
    { expiresIn: '365d' }
  );

  return {
    token,
    urlValidacao: `${env.FRONTEND_URL.replace(/\/$/, '')}/validar-comprovante/${token}`,
  };
}

export async function validarComprovanteToken(token: string) {
  let payload: ComprovanteTokenPayload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET) as ComprovanteTokenPayload;
  } catch {
    throw Object.assign(new Error('Token do comprovante inválido ou expirado'), { statusCode: 400 });
  }

  if (payload.type !== 'PONTO_COMPROVANTE' || !payload.pontoId || !payload.userId) {
    throw Object.assign(new Error('Token do comprovante inválido'), { statusCode: 400 });
  }

  const ponto = await getPontoComprovanteById(payload.pontoId);

  if (!ponto || ponto.userId !== payload.userId) {
    throw Object.assign(new Error('Comprovante não encontrado'), { statusCode: 404 });
  }

  return {
    pontoId: ponto.id,
    urlValidacao: `${env.FRONTEND_URL.replace(/\/$/, '')}/validar-comprovante/${token}`,
    verificadoEm: new Date().toISOString(),
    funcionario: {
      id: ponto.user.id,
      nome: ponto.user.name,
      loja: ponto.user.loja,
      role: ponto.user.role,
    },
    expediente: {
      data: ponto.date.toISOString(),
      status: getStatusComprovante(ponto),
      horasTrabalhadas: calcularHoras(ponto),
      encerramentoAutomatico: ponto.encerramentoAutomatico,
      emitidoEm: ponto.updatedAt.toISOString(),
    },
    registros: {
      entrada: ponto.entrada?.toISOString() ?? null,
      almoco: ponto.almoco?.toISOString() ?? null,
      retorno: ponto.retorno?.toISOString() ?? null,
      saida: ponto.saida?.toISOString() ?? null,
    },
  };
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
  loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II';
  startDate: string;
  endDate: string;
  requestUserId: string;
  requestUserRole: string;
}) {
  const { userId, loja, startDate, endDate, requestUserId, requestUserRole } = params;

  // EMPLOYEE só pode ver seus próprios dados
  const filterUserId = requestUserRole === 'ADMIN'
    ? (userId ?? undefined)
    : requestUserId;

  const usuariosEscopo = await carregarUsuariosEscopo(filterUserId, requestUserRole === 'ADMIN' ? loja : undefined);
  const userIds = usuariosEscopo.map((user) => user.id);

  const pontos = await prisma.ponto.findMany({
    where: {
      ...(userIds.length > 0 ? { userId: { in: userIds } } : { userId: '__no-user__' }),
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true, loja: true },
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

// ===== Métricas Agregadas =====

interface MetricasPonto {
  periodo: { inicio: string; fim: string };
  totalDias: number;
  diasTrabalhados: number;
  diasFalta: number;
  percentualPresenca: number;
  totalHorasTrabalhadas: string;
  mediaHorasPorDia: string;
  diasPontuais: number;
  percentualPontualidade: number;
  streakAtual: number;
  maiorStreak: number;
  encerramentosAutomaticos: number;
  horasPorDia: { data: string; horas: number }[];
  frequenciaSemanal: { semana: string; presencas: number; total: number }[];
}

type UsuarioEscopo = {
  id: string;
  name: string;
  jornadaEntrada: string;
  role?: 'ADMIN' | 'EMPLOYEE';
};

type PontoCalendario = {
  userId: string;
  date: Date;
  entrada: Date | null;
  almoco: Date | null;
  retorno: Date | null;
  saida: Date | null;
  status: 'NORMAL' | 'FOLGA' | 'FALTA';
  encerramentoAutomatico: boolean;
};

function listarDatasPeriodo(startDate: string, endDate: string): string[] {
  const datas: string[] = [];
  let cursor = DateTime.fromISO(startDate, { zone: 'utc' }).startOf('day');
  const end = DateTime.fromISO(endDate, { zone: 'utc' }).startOf('day');

  while (cursor <= end) {
    datas.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }

  return datas;
}

function getHojeDateKeySP(): string {
  return DateTime.now().setZone('America/Sao_Paulo').toISODate()!;
}

function limitarDataFinalAoHoje(endDate: string): string {
  const hoje = getHojeDateKeySP();
  return endDate < hoje ? endDate : hoje;
}

function getDateOnlyKey(date: Date): string {
  return parseDateOnly(date).toISODate()!;
}

function getDiaSemanaDateKey(dateKey: string): number {
  return DateTime.fromISO(dateKey, { zone: 'utc' }).weekday % 7;
}

function isDiaUtilDateKey(dateKey: string): boolean {
  return true;
}

function getWeekLabelFromDateKey(dateKey: string): string {
  return DateTime.fromISO(dateKey, { zone: 'utc' }).startOf('week').toFormat('dd/MM');
}

function getEasterDateKey(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftDateKey(dateKey: string, days: number): string {
  return DateTime.fromISO(dateKey, { zone: 'utc' }).plus({ days }).toISODate()!;
}

function isFeriadoDateKey(dateKey: string): boolean {
  const fixedHolidays = new Set([
    '01-01',
    '04-21',
    '05-01',
    '09-07',
    '10-12',
    '11-02',
    '11-15',
    '11-20',
    '12-25',
  ]);

  const [, month, day] = dateKey.split('-');
  if (fixedHolidays.has(`${month}-${day}`)) {
    return true;
  }

  const year = Number(dateKey.slice(0, 4));
  const pascoa = getEasterDateKey(year);
  const moveableHolidays = new Set([
    shiftDateKey(pascoa, -48),
    shiftDateKey(pascoa, -47),
    shiftDateKey(pascoa, -2),
    pascoa,
    shiftDateKey(pascoa, 60),
  ]);

  return moveableHolidays.has(dateKey);
}

function buildPontoMap<T extends { userId: string; date: Date }>(pontos: T[]): Map<string, T> {
  return new Map(pontos.map((ponto) => [`${ponto.userId}:${getDateOnlyKey(new Date(ponto.date))}`, ponto]));
}

function isEntradaPontualPorJornada(params: {
  entrada: Date;
  jornadaEntrada: string;
  dateKey: string;
  toleranciaMinutos?: number;
}): boolean {
  const { entrada, jornadaEntrada, dateKey, toleranciaMinutos = 15 } = params;
  const { hora, minuto } = getHoraMinutoSP(entrada);
  const entradaMinutos = hora * 60 + minuto;
  const [jornadaHora, jornadaMinuto] = jornadaEntrada.split(':').map(Number);
  const jornadaMinutos = (jornadaHora ?? 0) * 60 + (jornadaMinuto ?? 0);
  const diaSemana = getDiaSemanaDateKey(dateKey);
  const feriado = isFeriadoDateKey(dateKey);

  if (diaSemana === 0 || feriado) {
    const jornadaDomingoMinutos = 12 * 60;
    if (entradaMinutos <= jornadaDomingoMinutos + toleranciaMinutos) {
      return true;
    }
  }

  return entradaMinutos <= jornadaMinutos + toleranciaMinutos;
}

async function carregarUsuariosEscopo(filterUserId?: string, loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II'): Promise<UsuarioEscopo[]> {
  if (filterUserId) {
    const user = await prisma.user.findUnique({
      where: { id: filterUserId },
      select: { id: true, name: true, jornadaEntrada: true, role: true, loja: true, active: true },
    });

    return user && user.active && user.role === 'EMPLOYEE' && (!loja || user.loja === loja)
      ? [{ id: user.id, name: user.name, jornadaEntrada: user.jornadaEntrada, role: user.role }]
      : [];
  }

  return prisma.user.findMany({
    where: { active: true, role: 'EMPLOYEE', ...(loja ? { loja } : {}) },
    select: { id: true, name: true, jornadaEntrada: true, role: true },
    orderBy: { name: 'asc' },
  });
}

async function carregarFolgasPorUsuario(userIds: string[]): Promise<Map<string, Set<number>>> {
  const folgaMap = new Map<string, Set<number>>();

  if (userIds.length === 0) {
    return folgaMap;
  }

  const folgas = await prisma.folgaConfig.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, diaSemana: true },
  });

  for (const userId of userIds) {
    folgaMap.set(userId, new Set<number>());
  }

  for (const folga of folgas) {
    folgaMap.get(folga.userId)?.add(folga.diaSemana);
  }

  return folgaMap;
}

function isDiaEsperadoParaTrabalho(params: {
  dateKey: string;
  folgaDiasSemana: Set<number>;
  ponto?: { status: 'NORMAL' | 'FOLGA' | 'FALTA' } | null;
}): boolean {
  const { dateKey, folgaDiasSemana, ponto } = params;

  if (!isDiaUtilDateKey(dateKey)) return false;
  if (folgaDiasSemana.has(getDiaSemanaDateKey(dateKey))) return false;
  if (ponto?.status === 'FOLGA') return false;

  return true;
}

function calcularStreaksEsperados(params: {
  userId: string;
  datasPeriodo: string[];
  pontoMap: Map<string, PontoCalendario>;
  folgaDiasSemana: Set<number>;
}): { streakAtual: number; maiorStreak: number } {
  const hoje = DateTime.now().setZone('America/Sao_Paulo').toISODate()!;
  const datasRelevantes = params.datasPeriodo
    .filter((dateKey) => dateKey <= hoje)
    .filter((dateKey) => {
      const ponto = params.pontoMap.get(`${params.userId}:${dateKey}`);
      return isDiaEsperadoParaTrabalho({ dateKey, folgaDiasSemana: params.folgaDiasSemana, ponto });
    })
    .sort((a, b) => b.localeCompare(a));

  let streakAtual = 0;
  let maiorStreak = 0;
  let currentRun = 0;
  let contandoAtual = true;

  for (const dateKey of datasRelevantes) {
    const ponto = params.pontoMap.get(`${params.userId}:${dateKey}`);
    const presente = !!ponto?.entrada;

    if (presente) {
      currentRun++;
      if (contandoAtual) {
        streakAtual++;
      }
    } else {
      contandoAtual = false;
      if (currentRun > maiorStreak) {
        maiorStreak = currentRun;
      }
      currentRun = 0;
    }
  }

  if (currentRun > maiorStreak) {
    maiorStreak = currentRun;
  }

  return { streakAtual, maiorStreak };
}

/** Calcula métricas agregadas para o período */
export async function getMetricas(params: {
  userId?: string;
  loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II';
  startDate: string;
  endDate: string;
  requestUserId: string;
  requestUserRole: string;
}): Promise<MetricasPonto> {
  const { userId, loja, startDate, endDate, requestUserId, requestUserRole } = params;
  const endDateLimitado = limitarDataFinalAoHoje(endDate);

  const filterUserId = requestUserRole === 'ADMIN'
    ? (userId ?? undefined)
    : requestUserId;

  const usuariosEscopo = await carregarUsuariosEscopo(filterUserId, requestUserRole === 'ADMIN' ? loja : undefined);
  const userIds = usuariosEscopo.map((user) => user.id);
  const jornadaMap = new Map(usuariosEscopo.map((user) => [user.id, user.jornadaEntrada]));
  const folgaMap = await carregarFolgasPorUsuario(userIds);
  const datasPeriodo = startDate <= endDateLimitado ? listarDatasPeriodo(startDate, endDateLimitado) : [];

  const pontos = await prisma.ponto.findMany({
    where: {
      ...(userIds.length > 0 ? { userId: { in: userIds } } : { userId: '__no-user__' }),
      date: { gte: new Date(startDate), lte: new Date(endDateLimitado) },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  });

  const pontoMap = buildPontoMap(pontos as PontoCalendario[]);

  let totalDias = 0;
  let diasTrabalhados = 0;
  let diasFalta = 0;
  const weekMap = new Map<string, { presencas: number; total: number }>();

  for (const user of usuariosEscopo) {
    const folgaDiasSemana = folgaMap.get(user.id) ?? new Set<number>();

    for (const dateKey of datasPeriodo) {
      const ponto = pontoMap.get(`${user.id}:${dateKey}`);
      if (!isDiaEsperadoParaTrabalho({ dateKey, folgaDiasSemana, ponto })) {
        continue;
      }

      totalDias++;

      const weekLabel = getWeekLabelFromDateKey(dateKey);
      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, { presencas: 0, total: 0 });
      }

      const week = weekMap.get(weekLabel)!;
      week.total++;

      if (ponto?.entrada) {
        diasTrabalhados++;
        week.presencas++;
      } else {
        diasFalta++;
      }
    }
  }

  const percentualPresenca = totalDias > 0 ? Math.round((diasTrabalhados / totalDias) * 100) : 0;

  // Horas trabalhadas
  let totalMinutos = 0;
  const horasPorDiaMap = new Map<string, number>();
  let diasPontuais = 0;
  let encerramentosAutomaticos = 0;

  for (const ponto of pontos) {
    const mins = calcularMinutos(ponto);
    totalMinutos += mins;

    const dateKey = getDateOnlyKey(new Date(ponto.date));
    horasPorDiaMap.set(dateKey, (horasPorDiaMap.get(dateKey) ?? 0) + mins);

    if (ponto.entrada) {
      const jornadaEntrada = jornadaMap.get(ponto.userId) ?? env.HORARIO_ENTRADA_PONTUAL;
      if (isEntradaPontualPorJornada({ entrada: new Date(ponto.entrada), jornadaEntrada, dateKey, toleranciaMinutos: 15 })) {
        diasPontuais++;
      }
    }

    if (ponto.encerramentoAutomatico) {
      encerramentosAutomaticos++;
    }
  }

  const horasPorDia = Array.from(horasPorDiaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, minutos]) => ({
      data: DateTime.fromISO(dateKey, { zone: 'utc' }).toFormat('dd/MM'),
      horas: Math.round((minutos / 60) * 100) / 100,
    }));

  const totalH = Math.floor(totalMinutos / 60);
  const totalM = totalMinutos % 60;
  const totalHorasTrabalhadas = `${totalH}h${totalM.toString().padStart(2, '0')}m`;

  const mediaMinutosPorDia = diasTrabalhados > 0 ? Math.round(totalMinutos / diasTrabalhados) : 0;
  const mediaH = Math.floor(mediaMinutosPorDia / 60);
  const mediaM = mediaMinutosPorDia % 60;
  const mediaHorasPorDia = `${mediaH}h${mediaM.toString().padStart(2, '0')}m`;
  const percentualPontualidade = diasTrabalhados > 0 ? Math.round((diasPontuais / diasTrabalhados) * 100) : 0;

  const { streakAtual, maiorStreak } = usuariosEscopo.length === 1
    ? calcularStreaksEsperados({
      userId: usuariosEscopo[0]!.id,
      datasPeriodo,
      pontoMap: pontoMap as Map<string, PontoCalendario>,
      folgaDiasSemana: folgaMap.get(usuariosEscopo[0]!.id) ?? new Set<number>(),
    })
    : { streakAtual: 0, maiorStreak: 0 };

  const frequenciaSemanal = Array.from(weekMap.entries()).map(([semana, data]) => ({
    semana,
    ...data,
  }));

  return {
    periodo: { inicio: startDate, fim: endDateLimitado },
    totalDias,
    diasTrabalhados,
    diasFalta,
    percentualPresenca,
    totalHorasTrabalhadas,
    mediaHorasPorDia,
    diasPontuais,
    percentualPontualidade,
    streakAtual,
    maiorStreak,
    encerramentosAutomaticos,
    horasPorDia,
    frequenciaSemanal,
  };
}

/** Calcula minutos trabalhados de um ponto */
function calcularMinutos(ponto: { entrada: Date | null; almoco: Date | null; retorno: Date | null; saida: Date | null }): number {
  if (!ponto.entrada) return 0;
  const fimRef = ponto.saida ?? new Date();
  let totalMs = fimRef.getTime() - ponto.entrada.getTime();
  if (ponto.almoco && ponto.retorno) {
    totalMs -= ponto.retorno.getTime() - ponto.almoco.getTime();
  }
  return Math.max(0, Math.floor(totalMs / 60000));
}

// ===== Exportações =====

interface ExportPontoRow {
  nome: string;
  data: string;
  entrada: string;
  almoco: string;
  retorno: string;
  saida: string;
  horas: string;
  status: string;
  encAuto: string;
}

function pontosToRows(pontos: Array<{
  user: { name: string };
  date: Date;
  entrada: Date | null;
  almoco: Date | null;
  retorno: Date | null;
  saida: Date | null;
  encerramentoAutomatico: boolean;
}>): ExportPontoRow[] {
  return pontos.map((p) => {
    const horas = calcularHoras(p) ?? '—';
    let status = 'Ausente';
    if (p.saida) status = 'Completo';
    else if (p.entrada) status = 'Parcial';

    return {
      nome: p.user.name,
      data: formatarDateOnlyBR(new Date(p.date)),
      entrada: formatarHoraBR(p.entrada ? new Date(p.entrada) : null),
      almoco: formatarHoraBR(p.almoco ? new Date(p.almoco) : null),
      retorno: formatarHoraBR(p.retorno ? new Date(p.retorno) : null),
      saida: formatarHoraBR(p.saida ? new Date(p.saida) : null),
      horas,
      status,
      encAuto: p.encerramentoAutomatico ? 'Sim' : 'Não',
    };
  });
}

async function fetchExportPontos(params: {
  userId?: string;
  loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II';
  startDate: string;
  endDate: string;
}) {
  const usuariosEscopo = await carregarUsuariosEscopo(params.userId, params.loja);
  const userIds = usuariosEscopo.map((user) => user.id);

  return prisma.ponto.findMany({
    where: {
      ...(userIds.length > 0 ? { userId: { in: userIds } } : { userId: '__no-user__' }),
      date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
    },
    include: { user: { select: { id: true, name: true, initials: true, avatarColor: true } } },
    orderBy: { date: 'asc' },
  });
}

/** Exporta relatório em CSV */
export async function exportCSV(params: { userId?: string; loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II'; startDate: string; endDate: string }): Promise<string> {
  const pontos = await fetchExportPontos(params);
  const rows = pontosToRows(pontos);

  const header = 'Funcionário,Data,Entrada,Almoço,Retorno,Saída,Horas Trabalhadas,Status,Enc.Auto\n';
  const csvRows = rows.map((r) =>
    `"${r.nome}","${r.data}","${r.entrada}","${r.almoco}","${r.retorno}","${r.saida}","${r.horas}","${r.status}","${r.encAuto}"`
  );

  return '\uFEFF' + header + csvRows.join('\n');
}

/** Exporta relatório em Excel (.xlsx) */
export async function exportXLSX(params: { userId?: string; loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II'; startDate: string; endDate: string }): Promise<Buffer> {
  const pontos = await fetchExportPontos(params);
  const rows = pontosToRows(pontos);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GráficaOS';

  // Sheet 1: Pontos
  const sheet = workbook.addWorksheet('Pontos');

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C63FF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  sheet.columns = [
    { header: 'Funcionário', key: 'nome', width: 25 },
    { header: 'Data', key: 'data', width: 14 },
    { header: 'Entrada', key: 'entrada', width: 10 },
    { header: 'Almoço', key: 'almoco', width: 10 },
    { header: 'Retorno', key: 'retorno', width: 10 },
    { header: 'Saída', key: 'saida', width: 10 },
    { header: 'Horas', key: 'horas', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Enc. Auto', key: 'encAuto', width: 10 },
  ];

  // Estilizar header
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });
  headerRow.height = 28;

  // Dados
  for (const row of rows) {
    sheet.addRow(row);
  }

  // Sheet 2: Resumo
  const resumo = workbook.addWorksheet('Resumo');
  resumo.columns = [
    { header: 'Funcionário', key: 'nome', width: 25 },
    { header: 'Total Horas', key: 'totalHoras', width: 14 },
    { header: 'Dias Trabalhados', key: 'diasTrabalhados', width: 18 },
    { header: 'Faltas', key: 'faltas', width: 10 },
    { header: 'Enc. Auto', key: 'encAuto', width: 12 },
  ];

  const resumoHeader = resumo.getRow(1);
  resumoHeader.eachCell((cell) => {
    cell.style = headerStyle;
  });
  resumoHeader.height = 28;

  // Agrupar por usuário
  const porUsuario = new Map<string, { totalMin: number; dias: number; faltas: number; enc: number }>();
  for (const ponto of pontos) {
    const uid = ponto.userId;
    if (!porUsuario.has(uid)) {
      porUsuario.set(uid, { totalMin: 0, dias: 0, faltas: 0, enc: 0 });
    }
    const u = porUsuario.get(uid)!;
    if (ponto.entrada) {
      u.dias++;
      u.totalMin += calcularMinutos(ponto);
    } else {
      u.faltas++;
    }
    if (ponto.encerramentoAutomatico) u.enc++;
  }

  for (const ponto of pontos) {
    const uid = ponto.userId;
    const u = porUsuario.get(uid);
    if (!u) continue;

    const h = Math.floor(u.totalMin / 60);
    const m = u.totalMin % 60;

    // Evitar duplicatas no resumo
    if (resumo.getColumn('nome').values?.includes(ponto.user.name)) continue;

    resumo.addRow({
      nome: ponto.user.name,
      totalHoras: `${h}h${m.toString().padStart(2, '0')}m`,
      diasTrabalhados: u.dias,
      faltas: u.faltas,
      encAuto: u.enc,
    });
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Gera PDF do relatório */
export async function exportPDF(params: { userId?: string; loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II'; startDate: string; endDate: string }): Promise<Buffer> {
  const pontos = await fetchExportPontos(params);
  const rows = pontosToRows(pontos);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('GráficaOS — Relatório de Pontos', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
      .text(`Período: ${params.startDate} a ${params.endDate} | Gerado em: ${formatarDataHoraBR(new Date())}`, { align: 'center' });
    doc.moveDown(1);

    // Tabela
    const headers = ['Funcionário', 'Data', 'Entrada', 'Almoço', 'Retorno', 'Saída', 'Horas', 'Status', 'Enc.Auto'];
    const colWidths = [130, 70, 60, 60, 60, 60, 70, 65, 55];
    const startX = 40;
    let y = doc.y;

    // Header row
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.rect(x, y, colWidths[i]!, 20).fill('#6c63ff');
      doc.fillColor('#ffffff').text(headers[i]!, x + 4, y + 6, { width: colWidths[i]! - 8 });
      x += colWidths[i]!;
    }
    y += 20;

    // Data rows
    doc.font('Helvetica').fontSize(7).fillColor('#333333');
    for (const row of rows) {
      if (y > 540) {
        doc.addPage();
        y = 40;
        // Re-draw header
        x = startX;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
        for (let i = 0; i < headers.length; i++) {
          doc.rect(x, y, colWidths[i]!, 20).fill('#6c63ff');
          doc.fillColor('#ffffff').text(headers[i]!, x + 4, y + 6, { width: colWidths[i]! - 8 });
          x += colWidths[i]!;
        }
        y += 20;
        doc.font('Helvetica').fontSize(7).fillColor('#333333');
      }

      const values = [row.nome, row.data, row.entrada, row.almoco, row.retorno, row.saida, row.horas, row.status, row.encAuto];
      x = startX;
      const bgColor = rows.indexOf(row) % 2 === 0 ? '#f8f8f8' : '#ffffff';
      for (let i = 0; i < values.length; i++) {
        doc.rect(x, y, colWidths[i]!, 18).fill(bgColor);
        doc.fillColor('#333333').text(values[i]!, x + 4, y + 5, { width: colWidths[i]! - 8 });
        x += colWidths[i]!;
      }
      y += 18;
    }

    // ===== Resumo por funcionário =====
    // Calcular resumo
    const resumoMap = new Map<string, { nome: string; minutos: number; dias: number }>();
    for (const p of pontos) {
      const existing = resumoMap.get(p.user.name);
      let mins = 0;
      let worked = 0;
      if (p.entrada && p.saida) {
        let ms = p.saida.getTime() - p.entrada.getTime();
        if (p.almoco && p.retorno) ms -= p.retorno.getTime() - p.almoco.getTime();
        mins = Math.max(0, Math.floor(ms / 60000));
        worked = 1;
      } else if (p.entrada) {
        worked = 1;
      }
      if (existing) {
        existing.minutos += mins;
        existing.dias += worked;
      } else {
        resumoMap.set(p.user.name, { nome: p.user.name, minutos: mins, dias: worked });
      }
    }
    const resumo = Array.from(resumoMap.values()).sort((a, b) => b.minutos - a.minutos);

    if (resumo.length > 0) {
      // Verificar se precisa de nova página
      const resumoHeight = 30 + resumo.length * 18 + (resumo.length > 1 ? 20 : 0) + 20;
      if (y + resumoHeight > 540) {
        doc.addPage();
        y = 40;
      } else {
        y += 20;
      }

      // Título do resumo
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#333333')
        .text('Resumo do Período', startX, y);
      y += 20;

      // Header do resumo
      const rHeaders = ['Funcionário', 'Dias Trabalhados', 'Total de Horas', 'Média Diária'];
      const rColWidths = [200, 120, 140, 140];
      let rx = startX;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      for (let i = 0; i < rHeaders.length; i++) {
        doc.rect(rx, y, rColWidths[i]!, 20).fill('#6c63ff');
        doc.fillColor('#ffffff').text(rHeaders[i]!, rx + 4, y + 6, { width: rColWidths[i]! - 8 });
        rx += rColWidths[i]!;
      }
      y += 20;

      // Linhas do resumo
      doc.font('Helvetica').fontSize(8).fillColor('#333333');
      for (let idx = 0; idx < resumo.length; idx++) {
        const r = resumo[idx]!;
        const h = Math.floor(r.minutos / 60);
        const m = r.minutos % 60;
        const totalStr = `${h}h${m.toString().padStart(2, '0')}m`;
        const avgMin = r.dias > 0 ? Math.round(r.minutos / r.dias) : 0;
        const avgH = Math.floor(avgMin / 60);
        const avgM = avgMin % 60;
        const avgStr = `${avgH}h${avgM.toString().padStart(2, '0')}m / dia`;

        const rValues = [r.nome, `${r.dias} ${r.dias === 1 ? 'dia' : 'dias'}`, totalStr, avgStr];
        rx = startX;
        const bgColor = idx % 2 === 0 ? '#f0f0ff' : '#ffffff';
        for (let i = 0; i < rValues.length; i++) {
          doc.rect(rx, y, rColWidths[i]!, 18).fill(bgColor);
          doc.fillColor('#333333').text(rValues[i]!, rx + 4, y + 5, { width: rColWidths[i]! - 8 });
          rx += rColWidths[i]!;
        }
        y += 18;
      }

      // Linha de total geral (se mais de 1 funcionário)
      if (resumo.length > 1) {
        const totalDias = resumo.reduce((s, r) => s + r.dias, 0);
        const totalMin = resumo.reduce((s, r) => s + r.minutos, 0);
        const totalH = Math.floor(totalMin / 60);
        const totalM = totalMin % 60;
        const avgGeral = totalDias > 0 ? Math.round(totalMin / totalDias) : 0;
        const avgGeralH = Math.floor(avgGeral / 60);
        const avgGeralM = avgGeral % 60;

        rx = startX;
        const tValues = [
          'TOTAL GERAL',
          `${totalDias} dias`,
          `${totalH}h${totalM.toString().padStart(2, '0')}m`,
          `${avgGeralH}h${avgGeralM.toString().padStart(2, '0')}m / dia`,
        ];
        for (let i = 0; i < tValues.length; i++) {
          doc.rect(rx, y, rColWidths[i]!, 20).fill('#e8e6ff');
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#333333')
            .text(tValues[i]!, rx + 4, y + 6, { width: rColWidths[i]! - 8 });
          rx += rColWidths[i]!;
        }
        y += 20;
      }
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(7).fillColor('#999999').text(`Total de registros: ${rows.length}`, startX);

    doc.end();
  });
}

/** Envia relatório PDF por email */
export async function enviarRelatorioPorEmail(params: {
  userId?: string;
  loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II';
  startDate: string;
  endDate: string;
  destinatario: string;
}): Promise<{ sent: boolean; message: string }> {
  const hasResend = !!env.RESEND_API_KEY;
  const hasSMTP = !!env.SMTP_HOST && !!env.SMTP_USER;

  if (!hasResend && !hasSMTP) {
    throw Object.assign(
      new Error(
        'Email não configurado. Configure RESEND_API_KEY (recomendado) ou SMTP_HOST + SMTP_USER + SMTP_PASS no servidor.'
      ),
      { statusCode: 400 }
    );
  }

  const pdfBuffer = await exportPDF(params);
  const filename = `relatorio-pontos-${params.startDate}-a-${params.endDate}.pdf`;
  const subject = `GráficaOS — Relatório de Pontos (${params.startDate} a ${params.endDate})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6c63ff;">GráficaOS</h2>
      <p>Segue em anexo o relatório de pontos do período <strong>${params.startDate}</strong> a <strong>${params.endDate}</strong>.</p>
      <hr style="border: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">Este email foi gerado automaticamente pelo sistema GráficaOS.</p>
    </div>
  `;

  try {
    // Prioridade: Resend (HTTP API — funciona em qualquer host)
    if (hasResend) {
      const resend = new Resend(env.RESEND_API_KEY);
      await resend.emails.send({
        from: env.EMAIL_FROM || 'GráficaOS <onboarding@resend.dev>',
        to: [params.destinatario],
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer.toString('base64'),
          },
        ],
      });
    } else {
      // Fallback: SMTP (pode ter problemas em hosts como Render free)
      const isGmail = env.SMTP_HOST.includes('gmail');
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        ...(isGmail ? { tls: { rejectUnauthorized: false } } : {}),
      });

      await transporter.sendMail({
        from: env.SMTP_FROM || `GráficaOS <${env.SMTP_USER}>`,
        to: params.destinatario,
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('❌ Erro ao enviar email:', msg);
    throw Object.assign(
      new Error(`Falha ao enviar email: ${msg}`),
      { statusCode: 500 }
    );
  }

  return { sent: true, message: `Relatório enviado para ${params.destinatario}` };
}

// ===== Anomalias =====

export type AnomaliaTipo =
  | 'JORNADA_EXCESSIVA'
  | 'INTERVALO_CURTO'
  | 'ENTRADA_MUITO_CEDO'
  | 'SAIDA_MUITO_TARDE'
  | 'MULTIPLAS_BATIDAS_RAPIDAS';

export type AnomaliaSeveridade = 'BAIXA' | 'MEDIA' | 'ALTA';

export interface Anomalia {
  pontoId: string;
  userId: string;
  userName: string;
  data: string;
  tipo: AnomaliaTipo;
  severidade: AnomaliaSeveridade;
  descricao: string;
  sugestao?: string;
}

/** Detecta anomalias nos pontos do período */
export async function getAnomalias(params: {
  userId?: string;
  loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II';
  startDate: string;
  endDate: string;
}): Promise<Anomalia[]> {
  const usuariosEscopo = await carregarUsuariosEscopo(params.userId, params.loja);
  const userIds = usuariosEscopo.map((user) => user.id);

  const pontos = await prisma.ponto.findMany({
    where: {
      ...(userIds.length > 0 ? { userId: { in: userIds } } : { userId: '__no-user__' }),
      date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  });

  const anomalias: Anomalia[] = [];

  for (const ponto of pontos) {
    const dataStr = formatarDateOnlyBR(new Date(ponto.date));
    const base = { pontoId: ponto.id, userId: ponto.userId, userName: ponto.user.name, data: dataStr };

    if (ponto.entrada && ponto.saida) {
      // 1. Jornada excessiva (> 12h)
      const totalMs = new Date(ponto.saida).getTime() - new Date(ponto.entrada).getTime();
      let jornMs = totalMs;
      if (ponto.almoco && ponto.retorno) {
        jornMs -= new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
      }
      const jornadaH = jornMs / 3600000;
      if (jornadaH > 12) {
        anomalias.push({
          ...base,
          tipo: 'JORNADA_EXCESSIVA',
          severidade: 'ALTA',
          descricao: `Jornada de ${Math.round(jornadaH * 10) / 10}h detectada (limite: 12h)`,
          sugestao: 'Verificar se houve erro na batida de ponto',
        });
      }
    }

    // 2. Intervalo de almoço muito curto (< 30min)
    if (ponto.almoco && ponto.retorno) {
      const intervaloMs = new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
      const intervaloMin = intervaloMs / 60000;
      if (intervaloMin < 30) {
        anomalias.push({
          ...base,
          tipo: 'INTERVALO_CURTO',
          severidade: 'MEDIA',
          descricao: `Intervalo de almoço de ${Math.round(intervaloMin)}min (mínimo legal: 30min)`,
          sugestao: 'Verificar se o funcionário está fazendo intervalo adequado',
        });
      }
    }

    // 3. Entrada muito cedo (antes das 05h)
    if (ponto.entrada) {
      const { hora } = getHoraMinutoSP(new Date(ponto.entrada));
      if (hora < 5) {
        anomalias.push({
          ...base,
          tipo: 'ENTRADA_MUITO_CEDO',
          severidade: 'BAIXA',
          descricao: `Entrada às ${formatarHoraBR(new Date(ponto.entrada))} (antes das 05h)`,
          sugestao: 'Horário incomum — pode ser erro de batida',
        });
      }
    }

    // 4. Saída muito tarde (após 23h)
    if (ponto.saida && !ponto.encerramentoAutomatico) {
      const { hora } = getHoraMinutoSP(new Date(ponto.saida));
      if (hora >= 23) {
        anomalias.push({
          ...base,
          tipo: 'SAIDA_MUITO_TARDE',
          severidade: 'MEDIA',
          descricao: `Saída às ${formatarHoraBR(new Date(ponto.saida))} (após 23h)`,
          sugestao: 'Verificar se há hora extra não autorizada',
        });
      }
    }

    // 5. Batidas muito próximas (< 5min entre entrada→almoço ou almoço→retorno)
    if (ponto.entrada && ponto.almoco) {
      const diffMs = new Date(ponto.almoco).getTime() - new Date(ponto.entrada).getTime();
      if (diffMs < 300000 && diffMs >= 0) {
        anomalias.push({
          ...base,
          tipo: 'MULTIPLAS_BATIDAS_RAPIDAS',
          severidade: 'ALTA',
          descricao: `Entrada e almoço registrados com menos de 5min de diferença`,
          sugestao: 'Possível duplicação de batida — verificar com o funcionário',
        });
      }
    }
  }

  return anomalias;
}

// ===== Insights =====

export interface Destaque {
  tipo: 'POSITIVO' | 'NEUTRO' | 'ATENCAO';
  titulo: string;
  descricao: string;
  metrica?: string;
}

export interface FuncionarioDestaque {
  melhorPresenca: { nome: string; percentual: number } | null;
  melhorPontualidade: { nome: string; percentual: number } | null;
  maisHoras: { nome: string; horas: string } | null;
}

export interface InsightsPeriodo {
  periodo: { inicio: string; fim: string };
  destaques: Destaque[];
  funcionarioDestaque: FuncionarioDestaque;
  recomendacoes: string[];
}

/** Gera insights automáticos para o período */
export async function getInsights(params: {
  loja?: 'PAPER_OFFICE_I' | 'PAPER_OFFICE_II';
  startDate: string;
  endDate: string;
}): Promise<InsightsPeriodo> {
  const { startDate, endDate, loja } = params;
  const endDateLimitado = limitarDataFinalAoHoje(endDate);

  const users = await prisma.user.findMany({ where: { active: true, role: 'EMPLOYEE', ...(loja ? { loja } : {}) }, select: { id: true, name: true, jornadaEntrada: true } });
  const userIds = users.map((user) => user.id);
  const folgaMap = await carregarFolgasPorUsuario(userIds);
  const datasPeriodo = startDate <= endDateLimitado ? listarDatasPeriodo(startDate, endDateLimitado) : [];

  const pontos = await prisma.ponto.findMany({
    where: {
      ...(userIds.length > 0 ? { userId: { in: userIds } } : { userId: '__no-user__' }),
      date: { gte: new Date(startDate), lte: new Date(endDateLimitado) },
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  });
  const pontoMap = buildPontoMap(pontos as PontoCalendario[]);

  // Dados por funcionário
  const porFunc = new Map<string, {
    nome: string;
    diasEsperados: number;
    diasPresente: number;
    diasPontual: number;
    totalMinutos: number;
    encAuto: number;
  }>();

  for (const user of users) {
    porFunc.set(user.id, {
      nome: user.name,
      diasEsperados: 0,
      diasPresente: 0,
      diasPontual: 0,
      totalMinutos: 0,
      encAuto: 0,
    });
  }

  for (const user of users) {
    const folgaDiasSemana = folgaMap.get(user.id) ?? new Set<number>();
    const f = porFunc.get(user.id)!;

    for (const dateKey of datasPeriodo) {
      const ponto = pontoMap.get(`${user.id}:${dateKey}`);
      if (!isDiaEsperadoParaTrabalho({ dateKey, folgaDiasSemana, ponto })) {
        continue;
      }

      f.diasEsperados++;
      if (ponto?.entrada) {
        f.diasPresente++;
      }
    }
  }

  for (const ponto of pontos) {
    const f = porFunc.get(ponto.userId);
    if (!f) continue;

    if (ponto.entrada) {
      f.totalMinutos += calcularMinutos(ponto);

      const jornadaEntrada = users.find((user) => user.id === ponto.userId)?.jornadaEntrada ?? env.HORARIO_ENTRADA_PONTUAL;
      if (isEntradaPontualPorJornada({ entrada: new Date(ponto.entrada), jornadaEntrada, dateKey: getDateOnlyKey(new Date(ponto.date)) })) {
        f.diasPontual++;
      }
    }
    if (ponto.encerramentoAutomatico) f.encAuto++;
  }

  const destaques: Destaque[] = [];
  const recomendacoes: string[] = [];

  // Métricas gerais
  const totalPresencas = Array.from(porFunc.values()).reduce((sum, f) => sum + f.diasPresente, 0);
  const esperadoTotal = Array.from(porFunc.values()).reduce((sum, f) => sum + f.diasEsperados, 0);
  const presencaGeral = esperadoTotal > 0 ? Math.round((totalPresencas / esperadoTotal) * 100) : 0;

  if (presencaGeral >= 90) {
    destaques.push({
      tipo: 'POSITIVO',
      titulo: 'Presença excelente',
      descricao: `A equipe manteve ${presencaGeral}% de presença no período`,
      metrica: `${presencaGeral}%`,
    });
  } else if (presencaGeral < 70) {
    destaques.push({
      tipo: 'ATENCAO',
      titulo: 'Presença abaixo do ideal',
      descricao: `Apenas ${presencaGeral}% de presença no período`,
      metrica: `${presencaGeral}%`,
    });
  }

  // Encerramentos automáticos
  const totalEncAuto = pontos.filter(p => p.encerramentoAutomatico).length;
  if (totalEncAuto > 0) {
    const usersComEncAuto = new Set(pontos.filter(p => p.encerramentoAutomatico).map(p => p.user.name));
    destaques.push({
      tipo: 'ATENCAO',
      titulo: `${totalEncAuto} encerramento(s) automático(s)`,
      descricao: `${usersComEncAuto.size} funcionário(s) tiveram pontos encerrados automaticamente`,
      metrica: `${totalEncAuto}`,
    });

    for (const [, f] of porFunc) {
      if (f.encAuto >= 3) {
        recomendacoes.push(`Considere conversar com ${f.nome} sobre os ${f.encAuto} encerramentos automáticos`);
      }
    }
  }

  // Funcionários destaque
  let melhorPresenca: { nome: string; percentual: number } | null = null;
  let melhorPontualidade: { nome: string; percentual: number } | null = null;
  let maisHoras: { nome: string; horas: string } | null = null;
  let maisHorasMin = 0;

  for (const [, f] of porFunc) {
    const pctPresenca = f.diasEsperados > 0 ? Math.round((f.diasPresente / f.diasEsperados) * 100) : 0;
    const pctPontual = f.diasPresente > 0 ? Math.round((f.diasPontual / f.diasPresente) * 100) : 0;

    if (!melhorPresenca || pctPresenca > melhorPresenca.percentual) {
      melhorPresenca = { nome: f.nome, percentual: pctPresenca };
    }
    if (!melhorPontualidade || pctPontual > melhorPontualidade.percentual) {
      melhorPontualidade = { nome: f.nome, percentual: pctPontual };
    }
    const h = Math.floor(f.totalMinutos / 60);
    const m = f.totalMinutos % 60;
    const horasStr = `${h}h${m.toString().padStart(2, '0')}m`;
    if (f.totalMinutos > maisHorasMin) {
      maisHoras = { nome: f.nome, horas: horasStr };
      maisHorasMin = f.totalMinutos;
    }
  }

  // Presença perfeita
  if (melhorPresenca && melhorPresenca.percentual >= 100) {
    destaques.push({
      tipo: 'POSITIVO',
      titulo: `${melhorPresenca.nome} com 100% de presença`,
      descricao: 'Considere reconhecimento formal',
    });
    recomendacoes.push(`${melhorPresenca.nome} teve 100% de presença. Considere reconhecimento formal.`);
  }

  // Pontualidade média
  let totalPontuais = 0;
  let totalDiasPresentes = 0;
  for (const [, f] of porFunc) {
    totalPontuais += f.diasPontual;
    totalDiasPresentes += f.diasPresente;
  }
  const pontualidadeGeral = totalDiasPresentes > 0 ? Math.round((totalPontuais / totalDiasPresentes) * 100) : 0;
  if (pontualidadeGeral >= 90) {
    destaques.push({
      tipo: 'POSITIVO',
      titulo: 'Pontualidade exemplar',
      descricao: `${pontualidadeGeral}% dos registros dentro do horário`,
      metrica: `${pontualidadeGeral}%`,
    });
  } else if (pontualidadeGeral < 60) {
    destaques.push({
      tipo: 'ATENCAO',
      titulo: 'Pontualidade precisa de atenção',
      descricao: `Apenas ${pontualidadeGeral}% dos registros no horário`,
      metrica: `${pontualidadeGeral}%`,
    });
    recomendacoes.push('Considere uma conversa em equipe sobre horários de entrada');
  }

  return {
    periodo: { inicio: startDate, fim: endDateLimitado },
    destaques,
    funcionarioDestaque: { melhorPresenca, melhorPontualidade, maisHoras },
    recomendacoes,
  };
}

// ==================== Edição de Ponto (Admin) ====================

interface EditarPontoInput {
  pontoId: string;
  entrada?: string | null;
  almoco?: string | null;
  retorno?: string | null;
  saida?: string | null;
  status?: 'NORMAL' | 'FOLGA' | 'FALTA';
  date?: string; // formato "YYYY-MM-DD"
}

/**
 * Permite que um ADMIN edite os horários de um ponto existente.
 * Recebe strings ISO ou "HH:mm" para cada campo. Se "HH:mm", combina com a data do ponto.
 * Se null, limpa o campo.
 */
export async function editarPonto(input: EditarPontoInput) {
  const ponto = await prisma.ponto.findUnique({
    where: { id: input.pontoId },
  });

  if (!ponto) {
    throw Object.assign(new Error('Ponto não encontrado'), { statusCode: 404 });
  }

  // Converte "HH:mm" ou ISO string para Date (UTC), usando a data do ponto como base
  function parseTimeField(value: string | null | undefined, pontoDate: Date): Date | null | undefined {
    if (value === undefined) return undefined; // campo não enviado → não altera
    if (value === null || value === '') return null; // limpar o campo

    // Se for no formato "HH:mm", combina com a data do ponto no fuso de SP
    const hhmmMatch = value.match(/^(\d{2}):(\d{2})$/);
    if (hhmmMatch) {
      const [, hh, mm] = hhmmMatch;
      // Usa a data do ponto (que é meia-noite UTC representando o dia em SP)
      // e cria um DateTime no fuso de SP com a hora informada, depois converte pra UTC
      const pontoSP = DateTime.fromJSDate(pontoDate, { zone: 'America/Sao_Paulo' });
      const target = pontoSP.set({ hour: parseInt(hh!), minute: parseInt(mm!), second: 0, millisecond: 0 });
      return target.toJSDate();
    }

    // Caso contrário, tenta parsear como ISO
    return new Date(value);
  }

  const data: Record<string, Date | null | string> = {};

  const entradaParsed = parseTimeField(input.entrada, ponto.date);
  if (entradaParsed !== undefined) data.entrada = entradaParsed;

  const almocoParsed = parseTimeField(input.almoco, ponto.date);
  if (almocoParsed !== undefined) data.almoco = almocoParsed;

  const retornoParsed = parseTimeField(input.retorno, ponto.date);
  if (retornoParsed !== undefined) data.retorno = retornoParsed;

  const saidaParsed = parseTimeField(input.saida, ponto.date);
  if (saidaParsed !== undefined) data.saida = saidaParsed;

  // Suporte a alteração de status (NORMAL/FOLGA/FALTA)
  if (input.status) {
    data.status = input.status;
    // Se marcado como FOLGA ou FALTA, limpar todos os horários
    if (input.status === 'FOLGA' || input.status === 'FALTA') {
      data.entrada = null;
      data.almoco = null;
      data.retorno = null;
      data.saida = null;
    }
  }

  // Suporte a alteração de data
  if (input.date) {
    const newDate = DateTime.fromISO(input.date, { zone: 'America/Sao_Paulo' }).startOf('day').toJSDate();
    data.date = newDate as unknown as string; // Prisma aceita Date para campo Date
  }

  const updated = await prisma.ponto.update({
    where: { id: input.pontoId },
    data,
    include: {
      user: {
        select: { id: true, name: true, initials: true, avatarColor: true },
      },
    },
  });

  return updated;
}

// ==================== Ponto Manual (Admin) ====================

interface CriarPontoManualInput {
  userId: string;
  date: string; // "YYYY-MM-DD"
  entrada?: string | null;  // "HH:mm"
  almoco?: string | null;
  retorno?: string | null;
  saida?: string | null;
  status?: 'NORMAL' | 'FOLGA' | 'FALTA';
}

/**
 * Permite que ADMIN crie um registro de ponto manualmente para qualquer funcionário/dia.
 */
export async function criarPontoManual(input: CriarPontoManualInput) {
  const dateObj = DateTime.fromISO(input.date, { zone: 'America/Sao_Paulo' }).startOf('day').toJSDate();

  // Verifica se já existe ponto para esse dia
  const existing = await prisma.ponto.findUnique({
    where: { userId_date: { userId: input.userId, date: dateObj } },
  });
  if (existing) {
    throw Object.assign(new Error('Já existe um registro de ponto para este funcionário nesta data.'), { statusCode: 409 });
  }

  function toDate(hhmm: string | null | undefined): Date | null {
    if (!hhmm) return null;
    const match = hhmm.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, hh, mm] = match;
    const dt = DateTime.fromJSDate(dateObj, { zone: 'America/Sao_Paulo' })
      .set({ hour: parseInt(hh!), minute: parseInt(mm!), second: 0, millisecond: 0 });
    return dt.toJSDate();
  }

  const status = input.status ?? 'NORMAL';
  const isFolgaFalta = status === 'FOLGA' || status === 'FALTA';

  const ponto = await prisma.ponto.create({
    data: {
      userId: input.userId,
      date: dateObj,
      entrada: isFolgaFalta ? null : toDate(input.entrada),
      almoco: isFolgaFalta ? null : toDate(input.almoco),
      retorno: isFolgaFalta ? null : toDate(input.retorno),
      saida: isFolgaFalta ? null : toDate(input.saida),
      status,
    },
    include: {
      user: { select: { id: true, name: true, initials: true, avatarColor: true } },
    },
  });

  return ponto;
}

// ==================== Folga Config ====================

/** Lista folgas configuradas (todas ou de um usuário) */
export async function listarFolgas(userId?: string) {
  const where = userId ? { userId } : {};
  return prisma.folgaConfig.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, initials: true, avatarColor: true } },
    },
    orderBy: [{ userId: 'asc' }, { diaSemana: 'asc' }],
  });
}

/** Configura folgas de um funcionário (substitui dias anteriores) */
export async function configurarFolgas(userId: string, diasSemana: number[]) {
  // Remove folgas anteriores
  await prisma.folgaConfig.deleteMany({ where: { userId } });

  // Cria novas folgas
  if (diasSemana.length > 0) {
    await prisma.folgaConfig.createMany({
      data: diasSemana.map((dia) => ({ userId, diaSemana: dia })),
    });
  }

  return prisma.folgaConfig.findMany({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, initials: true, avatarColor: true } },
    },
    orderBy: { diaSemana: 'asc' },
  });
}

/** Verifica se um dia é folga para um usuário */
export async function isDiaFolga(userId: string, date: Date): Promise<boolean> {
  const diaSemana = DateTime.fromJSDate(date, { zone: 'America/Sao_Paulo' }).weekday % 7; // luxon: 1=Mon..7=Sun → 0=Sun..6=Sat
  const folga = await prisma.folgaConfig.findUnique({
    where: { userId_diaSemana: { userId, diaSemana } },
  });
  return !!folga;
}
