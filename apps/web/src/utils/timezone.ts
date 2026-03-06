import { DateTime } from 'luxon';

const TIMEZONE = 'America/Sao_Paulo';

/**
 * Converte ISO string do backend para DateTime em São Paulo.
 * Usar apenas para campos de data+hora (entrada, almoco, retorno, saida).
 */
export function parseDataHora(isoString: string): DateTime {
  return DateTime.fromISO(isoString, { zone: 'utc' }).setZone(TIMEZONE);
}

/**
 * Parse de campo date-only (@db.Date) sem conversão de timezone.
 * Campos date-only chegam como "2026-03-01T00:00:00.000Z" e devem ser
 * interpretados literalmente, sem shift UTC→SP que causaria dia anterior.
 */
export function parseDateOnly(isoString: string): DateTime {
  // Pega apenas YYYY-MM-DD e interpreta como data local (sem timezone shift)
  const dateStr = isoString.substring(0, 10);
  return DateTime.fromISO(dateStr);
}

/**
 * Formata data no padrão brasileiro (dd/MM/yyyy).
 * Usar para campos date-only como Ponto.date.
 */
export function formatarData(isoString: string | null): string {
  if (!isoString) return '—';
  return parseDateOnly(isoString).toFormat('dd/MM/yyyy');
}

/**
 * Formata hora no padrão brasileiro (HH:mm).
 */
export function formatarHora(isoString: string | null): string {
  if (!isoString) return '—';
  return parseDataHora(isoString).toFormat('HH:mm');
}

/**
 * Formata data e hora no padrão brasileiro (dd/MM/yyyy HH:mm).
 */
export function formatarDataHora(isoString: string | null): string {
  if (!isoString) return '—';
  return parseDataHora(isoString).toFormat('dd/MM/yyyy HH:mm');
}

/**
 * Obtém data/hora atual em SP para exibição de relógio.
 */
export function getAgoraSP(): DateTime {
  return DateTime.now().setZone(TIMEZONE);
}

/**
 * Formata data curta (dd/MM) para exibição em gráficos.
 * Usar para campos date-only como Ponto.date.
 */
export function formatarDataCurta(isoString: string): string {
  return parseDateOnly(isoString).toFormat('dd/MM');
}

/**
 * Formata dia da semana abreviado + data (ex: "seg, 05/03").
 * Usar para campos date-only como Ponto.date.
 */
export function formatarDiaSemanaData(isoString: string): string {
  const dt = parseDateOnly(isoString);
  return dt.setLocale('pt-BR').toFormat("ccc, dd/MM");
}
