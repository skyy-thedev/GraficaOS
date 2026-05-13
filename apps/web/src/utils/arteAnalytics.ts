import type { Arte, ArteStatus, ProdutoTipo, Urgencia } from '@/types';

export const PRODUTO_LABELS: Record<ProdutoTipo, string> = {
  AZULEJO: 'Azulejo',
  BANNER: 'Banner',
  ADESIVO: 'Adesivo',
  PLACA: 'Placa',
  FAIXA: 'Faixa',
  OUTRO: 'Outro',
};

export const STATUS_LABELS: Record<ArteStatus, string> = {
  TODO: 'A Fazer',
  DOING: 'Produção',
  REVIEW: 'Revisão',
  DONE: 'Concluído',
};

export const URGENCIA_LABELS: Record<Urgencia, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Urgente',
};

export function isArteAtiva(arte: Arte): boolean {
  return arte.status !== 'DONE';
}

export function isArteAtrasada(arte: Arte, now: Date): boolean {
  if (!arte.prazo || arte.status === 'DONE') return false;
  return new Date(arte.prazo).getTime() < now.getTime();
}

export function getUrgenciaPeso(urgencia: Urgencia): number {
  if (urgencia === 'HIGH') return 3;
  if (urgencia === 'NORMAL') return 2;
  return 1;
}

export function getStatusPeso(status: ArteStatus): number {
  if (status === 'REVIEW') return 4;
  if (status === 'DOING') return 3;
  if (status === 'TODO') return 2;
  return 1;
}

export function normalizarTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function extrairNumeroContato(value: string): string {
  return value.replace(/\D/g, '');
}
