import { prisma } from '../prisma/client';
import { env } from '../config/env';
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
        select: { id: true, name: true, initials: true, avatarColor: true },
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

/** Calcula métricas agregadas para o período */
export async function getMetricas(params: {
  userId?: string;
  startDate: string;
  endDate: string;
  requestUserId: string;
  requestUserRole: string;
}): Promise<MetricasPonto> {
  const { userId, startDate, endDate, requestUserId, requestUserRole } = params;

  const filterUserId = requestUserRole === 'ADMIN'
    ? (userId ?? undefined)
    : requestUserId;

  const pontos = await prisma.ponto.findMany({
    where: {
      ...(filterUserId ? { userId: filterUserId } : {}),
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  });

  // Dias úteis no período (seg-sex)
  const start = new Date(startDate);
  const end = new Date(endDate);
  let totalDias = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) totalDias++;
    cursor.setDate(cursor.getDate() + 1);
  }

  const diasTrabalhados = pontos.filter((p) => p.entrada !== null).length;
  const diasFalta = Math.max(0, totalDias - diasTrabalhados);
  const percentualPresenca = totalDias > 0 ? Math.round((diasTrabalhados / totalDias) * 100) : 0;

  // Horas trabalhadas
  let totalMinutos = 0;
  const horasPorDia: { data: string; horas: number }[] = [];

  for (const ponto of pontos) {
    const mins = calcularMinutos(ponto);
    totalMinutos += mins;
    horasPorDia.push({
      data: formatarDateOnlyCurtaBR(new Date(ponto.date)),
      horas: Math.round((mins / 60) * 100) / 100,
    });
  }

  const totalH = Math.floor(totalMinutos / 60);
  const totalM = totalMinutos % 60;
  const totalHorasTrabalhadas = `${totalH}h${totalM.toString().padStart(2, '0')}m`;

  const mediaMinutosPorDia = diasTrabalhados > 0 ? Math.round(totalMinutos / diasTrabalhados) : 0;
  const mediaH = Math.floor(mediaMinutosPorDia / 60);
  const mediaM = mediaMinutosPorDia % 60;
  const mediaHorasPorDia = `${mediaH}h${mediaM.toString().padStart(2, '0')}m`;

  // Pontualidade (entrada antes do horário pontual)
  const [pontualH, pontualM] = env.HORARIO_ENTRADA_PONTUAL.split(':').map(Number) as [number, number];
  let diasPontuais = 0;
  for (const ponto of pontos) {
    if (ponto.entrada) {
      // Extrair hora no fuso do Brasil usando Luxon
      const { hora: entradaH, minuto: entradaM } = getHoraMinutoSP(new Date(ponto.entrada));
      if (entradaH < pontualH || (entradaH === pontualH && entradaM <= pontualM)) {
        diasPontuais++;
      }
    }
  }
  const percentualPontualidade = diasTrabalhados > 0 ? Math.round((diasPontuais / diasTrabalhados) * 100) : 0;

  // Streak — dias consecutivos de trabalho até hoje (percorre de trás pra frente)
  const { streakAtual, maiorStreak } = calcularStreaks(pontos);

  // Encerramentos automáticos
  const encerramentosAutomaticos = pontos.filter((p) => p.encerramentoAutomatico).length;

  // Frequência semanal
  const weekMap = new Map<string, { presencas: number; total: number }>();
  for (const ponto of pontos) {
    const dt = parseDateOnly(new Date(ponto.date));
    const weekStart = dt.startOf('week'); // Luxon: week starts Monday
    const weekLabel = weekStart.toFormat('dd/MM');

    if (!weekMap.has(weekLabel)) {
      weekMap.set(weekLabel, { presencas: 0, total: 0 });
    }
    const week = weekMap.get(weekLabel)!;
    week.total++;
    if (ponto.entrada) week.presencas++;
  }

  const frequenciaSemanal = Array.from(weekMap.entries()).map(([semana, data]) => ({
    semana,
    ...data,
  }));

  return {
    periodo: { inicio: startDate, fim: endDate },
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

/** Calcula streak atual e maior streak */
function calcularStreaks(pontos: { entrada: Date | null; date: Date }[]) {
  // Ordenar do mais recente ao mais antigo
  const sorted = [...pontos].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let streakAtual = 0;
  let contandoAtual = true;
  let maiorStreak = 0;
  let currentRun = 0;

  for (const ponto of sorted) {
    if (ponto.entrada) {
      if (contandoAtual) streakAtual++;
      currentRun++;
    } else {
      contandoAtual = false;
      if (currentRun > maiorStreak) maiorStreak = currentRun;
      currentRun = 0;
    }
  }
  if (currentRun > maiorStreak) maiorStreak = currentRun;
  if (streakAtual > maiorStreak) maiorStreak = streakAtual;

  return { streakAtual, maiorStreak };
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
  startDate: string;
  endDate: string;
}) {
  return prisma.ponto.findMany({
    where: {
      ...(params.userId ? { userId: params.userId } : {}),
      date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
    },
    include: { user: { select: { id: true, name: true, initials: true, avatarColor: true } } },
    orderBy: { date: 'asc' },
  });
}

/** Exporta relatório em CSV */
export async function exportCSV(params: { userId?: string; startDate: string; endDate: string }): Promise<string> {
  const pontos = await fetchExportPontos(params);
  const rows = pontosToRows(pontos);

  const header = 'Funcionário,Data,Entrada,Almoço,Retorno,Saída,Horas Trabalhadas,Status,Enc.Auto\n';
  const csvRows = rows.map((r) =>
    `"${r.nome}","${r.data}","${r.entrada}","${r.almoco}","${r.retorno}","${r.saida}","${r.horas}","${r.status}","${r.encAuto}"`
  );

  return '\uFEFF' + header + csvRows.join('\n');
}

/** Exporta relatório em Excel (.xlsx) */
export async function exportXLSX(params: { userId?: string; startDate: string; endDate: string }): Promise<Buffer> {
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
export async function exportPDF(params: { userId?: string; startDate: string; endDate: string }): Promise<Buffer> {
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
  startDate: string;
  endDate: string;
}): Promise<Anomalia[]> {
  const pontos = await prisma.ponto.findMany({
    where: {
      ...(params.userId ? { userId: params.userId } : {}),
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
  startDate: string;
  endDate: string;
}): Promise<InsightsPeriodo> {
  const { startDate, endDate } = params;

  const pontos = await prisma.ponto.findMany({
    where: {
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
  });

  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } });

  // Dias úteis no período
  const start = new Date(startDate);
  const end = new Date(endDate);
  let totalDiasUteis = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) totalDiasUteis++;
    cursor.setDate(cursor.getDate() + 1);
  }

  // Dados por funcionário
  const porFunc = new Map<string, {
    nome: string;
    diasPresente: number;
    diasPontual: number;
    totalMinutos: number;
    encAuto: number;
  }>();

  const [pontualH, pontualM] = env.HORARIO_ENTRADA_PONTUAL.split(':').map(Number) as [number, number];

  for (const ponto of pontos) {
    const uid = ponto.userId;
    if (!porFunc.has(uid)) {
      porFunc.set(uid, { nome: ponto.user.name, diasPresente: 0, diasPontual: 0, totalMinutos: 0, encAuto: 0 });
    }
    const f = porFunc.get(uid)!;

    if (ponto.entrada) {
      f.diasPresente++;
      f.totalMinutos += calcularMinutos(ponto);

      // Pontualidade
      const { hora, minuto } = getHoraMinutoSP(new Date(ponto.entrada));
      if (hora < pontualH || (hora === pontualH && minuto <= pontualM)) {
        f.diasPontual++;
      }
    }
    if (ponto.encerramentoAutomatico) f.encAuto++;
  }

  const destaques: Destaque[] = [];
  const recomendacoes: string[] = [];

  // Métricas gerais
  const totalPresencas = pontos.filter(p => p.entrada).length;
  const totalFuncionarios = users.length;
  const esperadoTotal = totalDiasUteis * totalFuncionarios;
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
    const pctPresenca = totalDiasUteis > 0 ? Math.round((f.diasPresente / totalDiasUteis) * 100) : 0;
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
    periodo: { inicio: startDate, fim: endDate },
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
