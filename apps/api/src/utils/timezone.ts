import { DateTime } from 'luxon';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Converte Date do JavaScript (sempre em UTC internamente) para DateTime do Luxon
 * no timezone de São Paulo.
 */
export function toSaoPaulo(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(TIMEZONE);
}

/**
 * Obtém a data atual (só a data, sem hora) no timezone de São Paulo.
 * Retorna como Date em UTC mas representando o dia correto em SP.
 *
 * Exemplo: Se em SP é 05/03/2024 02:00 (ainda 04/03 23:00 em UTC)
 * → Retorna Date representando 05/03/2024 00:00:00 UTC
 */
export function getHojeEmSaoPaulo(): Date {
  const agoraEmSP = DateTime.now().setZone(TIMEZONE);

  // Criar data em UTC que representa o dia atual em SP
  return DateTime.utc(
    agoraEmSP.year,
    agoraEmSP.month,
    agoraEmSP.day,
    0, 0, 0, 0
  ).toJSDate();
}

/**
 * Obtém o DateTime exato atual em São Paulo (com hora).
 */
export function getAgoraEmSaoPaulo(): DateTime {
  return DateTime.now().setZone(TIMEZONE);
}

/**
 * Obtém a hora atual em São Paulo como Date JS (para gravar no banco).
 * O valor interno é UTC, mas representa o instante correto.
 */
export function getAgoraComoDate(): Date {
  return new Date(); // new Date() já é UTC internamente — Prisma grava como UTC
}

/**
 * Formata Date para string de data no formato brasileiro (dd/MM/yyyy).
 * Converte de UTC para SP antes de formatar.
 * Usar para campos de data+hora (entrada, almoco, retorno, saida).
 */
export function formatarDataBR(date: Date | DateTime): string {
  const dt = date instanceof Date ? toSaoPaulo(date) : date;
  return dt.toFormat('dd/MM/yyyy');
}

/**
 * Parse de campo date-only (@db.Date) sem conversão de timezone.
 * Campos date-only chegam como Date("2026-03-01T00:00:00.000Z") e devem
 * ser interpretados literalmente sem shift UTC→SP (que causaria dia anterior).
 */
export function parseDateOnly(date: Date): DateTime {
  // Extrai ano/mês/dia diretamente do UTC (que é onde @db.Date armazena midnight)
  return DateTime.fromObject(
    { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
  );
}

/**
 * Formata campo date-only no formato brasileiro (dd/MM/yyyy).
 * NÃO aplica conversão UTC→SP — interpreta a data literalmente.
 */
export function formatarDateOnlyBR(date: Date): string {
  return parseDateOnly(date).toFormat('dd/MM/yyyy');
}

/**
 * Formata campo date-only no formato curto (dd/MM).
 * NÃO aplica conversão UTC→SP — interpreta a data literalmente.
 */
export function formatarDateOnlyCurtaBR(date: Date): string {
  return parseDateOnly(date).toFormat('dd/MM');
}

/**
 * Formata Date para string de hora no formato brasileiro (HH:mm).
 * Converte de UTC para SP antes de formatar.
 */
export function formatarHoraBR(date: Date | DateTime | null): string {
  if (!date) return '—';
  const dt = date instanceof Date ? toSaoPaulo(date) : date;
  return dt.toFormat('HH:mm');
}

/**
 * Formata Date para string de data+hora no formato brasileiro (dd/MM/yyyy HH:mm).
 * Converte de UTC para SP antes de formatar.
 */
export function formatarDataHoraBR(date: Date | DateTime): string {
  const dt = date instanceof Date ? toSaoPaulo(date) : date;
  return dt.toFormat('dd/MM/yyyy HH:mm');
}

/**
 * Calcula diferença em horas e minutos entre dois horários.
 * Retorna string no formato "Xh Ym".
 */
export function calcularDiferencaHoras(inicio: Date, fim: Date): string {
  const dtInicio = toSaoPaulo(inicio);
  const dtFim = toSaoPaulo(fim);

  const diff = dtFim.diff(dtInicio, ['hours', 'minutes']);
  const horas = Math.floor(diff.hours);
  const minutos = Math.round(diff.minutes % 60);

  return `${horas}h${String(minutos).padStart(2, '0')}m`;
}

/**
 * Extrai hora e minuto de uma Date no fuso de São Paulo.
 * Útil para verificações de pontualidade.
 */
export function getHoraMinutoSP(date: Date): { hora: number; minuto: number } {
  const dt = toSaoPaulo(date);
  return { hora: dt.hour, minuto: dt.minute };
}
