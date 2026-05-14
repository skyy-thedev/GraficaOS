import type { Loja } from '@/types';

export const LOJA_LABELS: Record<Loja, string> = {
  PAPER_OFFICE_I: 'PaperOffice I',
  PAPER_OFFICE_II: 'PaperOffice II',
};

export const LOJA_COLORS: Record<Loja, string> = {
  PAPER_OFFICE_I: '#4db8ff',
  PAPER_OFFICE_II: '#22d3a0',
};

export const LOJA_OPTIONS: Array<{ value: Loja; label: string }> = [
  { value: 'PAPER_OFFICE_I', label: LOJA_LABELS.PAPER_OFFICE_I },
  { value: 'PAPER_OFFICE_II', label: LOJA_LABELS.PAPER_OFFICE_II },
];
