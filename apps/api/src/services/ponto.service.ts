import { prisma } from '../prisma/client';
import { env } from '../config/env';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Retorna a data/hora atual no fuso de São Paulo (America/Sao_Paulo).
 * Necessário porque o servidor roda em UTC (Render) mas os usuários estão no Brasil.
 */

function getBrazilNow(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  // Monta string ISO com offset -03:00
  const iso = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-03:00`;
  return new Date(iso);
}

/**
 * Retorna a data de hoje no formato Date (início do dia, sem horário)
 * para uso no campo @db.Date do Prisma.
 * Usa o fuso de São Paulo para determinar qual dia é "hoje".
 */
function getToday(): Date {
  const br = getBrazilNow();
  return new Date(Date.UTC(br.getFullYear(), br.getMonth(), br.getDate()));
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
  const agora = getBrazilNow();

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
      data: format(new Date(ponto.date), 'dd/MM'),
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
      // Extrair hora no fuso do Brasil
      const brParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date(ponto.entrada));
      const entradaH = Number(brParts.find(p => p.type === 'hour')?.value ?? 0);
      const entradaM = Number(brParts.find(p => p.type === 'minute')?.value ?? 0);
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
    const d = new Date(ponto.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1); // segunda
    const weekLabel = `${format(weekStart, 'dd/MM')}`;

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
      data: format(new Date(p.date), 'dd/MM/yyyy'),
      entrada: p.entrada ? format(new Date(p.entrada), 'HH:mm') : '—',
      almoco: p.almoco ? format(new Date(p.almoco), 'HH:mm') : '—',
      retorno: p.retorno ? format(new Date(p.retorno), 'HH:mm') : '—',
      saida: p.saida ? format(new Date(p.saida), 'HH:mm') : '—',
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
      .text(`Período: ${params.startDate} a ${params.endDate} | Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, { align: 'center' });
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
