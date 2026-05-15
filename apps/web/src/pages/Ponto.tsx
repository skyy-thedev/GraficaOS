import { Topbar } from '@/components/layout/Topbar';
import { usePontoHoje, useBaterPonto, useRelatorio, usePontoMetricas } from '@/hooks/usePonto';
import { pontosApi } from '@/services/endpoints';
import { useState, useEffect, useMemo, useRef } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import {
  Clock,
  Calendar,
  Timer,
  LogIn,
  Coffee,
  RotateCcw,
  LogOut,
  CheckCircle,
  Flame,
  BarChart3,
  Target,
  Briefcase,
  Download,
  Sparkles,
} from 'lucide-react';
import type { Loja, Ponto } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { formatarHora, getAgoraSP, parseDateOnly } from '@/utils/timezone';

type ComprovanteFuncionario = {
  nome: string;
  id: string;
  loja: Loja | null;
};

function calcularHoras(ponto: Ponto): string | null {
  if (!ponto.entrada || !ponto.saida) return null;
  let totalMs = new Date(ponto.saida).getTime() - new Date(ponto.entrada).getTime();
  if (ponto.almoco && ponto.retorno) {
    totalMs -= new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
  }
  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes.toString().padStart(2, '0')}m`;
}

function calcularHorasEmCurso(ponto: Ponto): string | null {
  if (!ponto.entrada) return null;
  const now = new Date();
  let totalMs = now.getTime() - new Date(ponto.entrada).getTime();
  if (ponto.almoco && ponto.retorno) {
    totalMs -= new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
  } else if (ponto.almoco && !ponto.retorno) {
    totalMs -= now.getTime() - new Date(ponto.almoco).getTime();
  }
  if (totalMs < 0) totalMs = 0;
  const totalMinutes = Math.floor(totalMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes.toString().padStart(2, '0')}m`;
}

function getPontoStatusLabel(ponto: Ponto): { label: string; color: string } {
  if (ponto.saida) return { label: 'Completo', color: 'var(--green)' };
  if (ponto.entrada) return { label: 'Parcial', color: 'var(--yellow)' };
  return { label: 'Falta', color: 'var(--red)' };
}

function getButtonState(pontoHoje: Ponto | null | undefined) {
  if (!pontoHoje || !pontoHoje.entrada) {
    return {
      label: 'Registrar Entrada',
      icon: LogIn,
      gradient: 'linear-gradient(135deg, #22d3a0, #1ab87e)',
      shadow: 'rgba(34,211,160,0.25)',
      color: '#fff',
      disabled: false,
    };
  }
  if (!pontoHoje.almoco) {
    return {
      label: 'Saída Almoço',
      icon: Coffee,
      gradient: 'linear-gradient(135deg, #f5c542, #e0a800)',
      shadow: 'rgba(245,197,66,0.25)',
      color: '#0a0a0f',
      disabled: false,
    };
  }
  if (!pontoHoje.retorno) {
    return {
      label: 'Retorno Almoço',
      icon: RotateCcw,
      gradient: 'linear-gradient(135deg, #4db8ff, #2196e0)',
      shadow: 'rgba(77,184,255,0.25)',
      color: '#fff',
      disabled: false,
    };
  }
  if (!pontoHoje.saida) {
    return {
      label: 'Registrar Saída',
      icon: LogOut,
      gradient: 'linear-gradient(135deg, #ff5e5e, #e03030)',
      shadow: 'rgba(255,94,94,0.25)',
      color: '#fff',
      disabled: false,
    };
  }
  return {
    label: 'Expediente Encerrado',
    icon: CheckCircle,
    gradient: 'none',
    shadow: 'none',
    color: 'var(--text3)',
    disabled: true,
    bg: 'var(--bg3)',
  };
}

function getWorkingStatus(pontoHoje: Ponto | null | undefined): { label: string; dotColor: string } | null {
  if (!pontoHoje || !pontoHoje.entrada) return null;
  if (pontoHoje.saida) return { label: 'Expediente encerrado', dotColor: 'var(--green)' };
  if (pontoHoje.retorno) return { label: 'Trabalhando', dotColor: 'var(--green)' };
  if (pontoHoje.almoco) return { label: 'No almoço', dotColor: 'var(--yellow)' };
  return { label: 'Trabalhando', dotColor: 'var(--green)' };
}

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return formatarHora(dateStr);
}

function getStreakBadge(streak: number): { emoji: string; label: string; color: string } | null {
  if (streak >= 180) return { emoji: '👑', label: 'LENDÁRIO', color: 'var(--accent)' };
  if (streak >= 90) return { emoji: '💎', label: 'DIAMANTE', color: 'var(--blue)' };
  if (streak >= 30) return { emoji: '🏆', label: '1 MÊS', color: 'var(--yellow)' };
  if (streak >= 7) return { emoji: '🔥', label: '1 SEMANA', color: 'var(--orange)' };
  return null;
}

function getPontualidadeBadge(pct: number): { label: string; color: string; dimColor: string } {
  if (pct >= 90) return { label: 'Excelente', color: 'var(--green)', dimColor: 'var(--green-dim)' };
  if (pct >= 75) return { label: 'Bom', color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' };
  return { label: 'Atenção', color: 'var(--red)', dimColor: 'var(--red-dim)' };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const TIMELINE_ITEMS = [
  { key: 'entrada' as const, label: 'Entrada', icon: LogIn, color: 'var(--green)', dimColor: 'var(--green-dim)' },
  { key: 'almoco' as const, label: 'Saída Almoço', icon: Coffee, color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' },
  { key: 'retorno' as const, label: 'Retorno', icon: RotateCcw, color: 'var(--blue)', dimColor: 'var(--blue-dim)' },
  { key: 'saida' as const, label: 'Saída', icon: LogOut, color: 'var(--red)', dimColor: 'var(--red-dim)' },
];

function formatarLoja(loja: Loja | null | undefined): string {
  if (loja === 'PAPER_OFFICE_I') return 'PaperOffice I';
  if (loja === 'PAPER_OFFICE_II') return 'PaperOffice II';
  return 'Não informada';
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem do QR code'));
    image.src = src;
  });
}

function ajustarTextoCanvas(ctx: CanvasRenderingContext2D, texto: string, larguraMaxima: number): string {
  if (ctx.measureText(texto).width <= larguraMaxima) {
    return texto;
  }

  const sufixo = '...';
  let textoAjustado = texto;

  while (textoAjustado.length > 0 && ctx.measureText(`${textoAjustado}${sufixo}`).width > larguraMaxima) {
    textoAjustado = textoAjustado.slice(0, -1);
  }

  return `${textoAjustado}${sufixo}`;
}

async function gerarComprovantePng(ponto: Ponto, funcionario: ComprovanteFuncionario, urlValidacao: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const qrCodeDataUrl = await QRCode.toDataURL(urlValidacao, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    color: {
      dark: '#15172b',
      light: '#0000',
    },
  });
  const qrImage = await carregarImagem(qrCodeDataUrl);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f1020');
  gradient.addColorStop(1, '#17192f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(108, 99, 255, 0.12)';
  ctx.beginPath();
  ctx.arc(880, 180, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8f8ff';
  ctx.font = '700 52px Segoe UI';
  ctx.fillText('Comprovante de ponto', 72, 110);

  ctx.fillStyle = '#9aa0bc';
  ctx.font = '400 28px Segoe UI';
  ctx.fillText('GraficaOS • Registro diário do funcionário', 72, 156);

  const date = parseDateOnly(ponto.date).toJSDate();
  const dateLabel = format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const nomeFuncionario = funcionario.nome.trim() || 'Funcionário não identificado';
  const lojaLabel = formatarLoja(funcionario.loja);
  const idLabel = funcionario.id || ponto.userId;

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, 72, 210, 936, 228, 28);
  ctx.fill();

  ctx.fillStyle = '#6c63ff';
  ctx.font = '600 26px Segoe UI';
  ctx.fillText('Data do expediente', 108, 266);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px Segoe UI';
  ctx.fillText(ajustarTextoCanvas(ctx, dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1), 820), 108, 324);

  ctx.fillStyle = '#9aa0bc';
  ctx.font = '600 24px Segoe UI';
  ctx.fillText('Funcionário', 108, 378);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Segoe UI';
  ctx.fillText(ajustarTextoCanvas(ctx, nomeFuncionario, 820), 108, 420);

  ctx.fillStyle = '#9aa0bc';
  ctx.font = '500 20px Segoe UI';
  ctx.fillText(`Loja: ${lojaLabel}`, 108, 462);
  ctx.fillText(`ID: ${ajustarTextoCanvas(ctx, idLabel, 410)}`, 500, 462);

  const totalHoras = calcularHoras(ponto) ?? calcularHorasEmCurso(ponto) ?? '—';
  const items = TIMELINE_ITEMS.map((item) => ({
    ...item,
    value: fmtTime(ponto[item.key] ?? null),
    drawColor:
      item.key === 'entrada'
        ? '#22d3a0'
        : item.key === 'almoco'
          ? '#f5c542'
          : item.key === 'retorno'
            ? '#4db8ff'
            : '#ff6a6a',
  }));
  const status = getPontoStatusLabel(ponto);

  const cardsStartX = 72;
  const cardsStartY = 486;
  const cardsGapX = 28;
  const cardsGapY = 24;
  const cardsWidth = (936 - cardsGapX) / 2;
  const cardsHeight = 126;

  items.forEach((item, index) => {
    const coluna = index % 2;
    const linha = Math.floor(index / 2);
    const cardX = cardsStartX + coluna * (cardsWidth + cardsGapX);
    const cardY = cardsStartY + linha * (cardsHeight + cardsGapY);

    const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardsWidth, cardY + cardsHeight);
    cardGradient.addColorStop(0, 'rgba(255,255,255,0.055)');
    cardGradient.addColorStop(1, 'rgba(255,255,255,0.028)');
    ctx.fillStyle = cardGradient;
    roundRect(ctx, cardX, cardY, cardsWidth, cardsHeight, 24);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, cardX, cardY, cardsWidth, cardsHeight, 24);
    ctx.stroke();

    ctx.fillStyle = `${item.drawColor}20`;
    roundRect(ctx, cardX + 18, cardY + 18, cardsWidth - 36, 6, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, cardX + 18, cardY + 30, cardsWidth - 36, 34, 17);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    roundRect(ctx, cardX + 18, cardY + 30, cardsWidth - 36, 34, 17);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = item.drawColor;
    ctx.shadowBlur = 16;
    ctx.fillStyle = `${item.drawColor}22`;
    ctx.beginPath();
    ctx.arc(cardX + 42, cardY + 47, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = item.drawColor;
    ctx.beginPath();
    ctx.arc(cardX + 42, cardY + 47, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(cardX + 42, cardY + 47, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9aa0bc';
    ctx.font = '700 18px Segoe UI';
    ctx.fillText(item.label, cardX + 72, cardY + 52);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, cardX + 18, cardY + 76, cardsWidth - 36, 34, 17);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px Consolas';
    ctx.fillText(item.value, cardX + 34, cardY + 101);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  roundRect(ctx, 72, 792, 936, 142, 28);
  ctx.fill();

  ctx.fillStyle = '#9aa0bc';
  ctx.font = '600 24px Segoe UI';
  ctx.fillText('Resumo do dia', 108, 848);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Consolas';
  ctx.fillText(`Total trabalhado: ${totalHoras}`, 108, 894);

  ctx.fillStyle = status.color === 'var(--green)' ? '#22d3a0' : status.color === 'var(--yellow)' ? '#f5c542' : '#ff6a6a';
  ctx.fillText(`Status: ${status.label}`, 108, 930);

  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  roundRect(ctx, 72, 964, 936, 224, 28);
  ctx.fill();

  ctx.fillStyle = '#6c63ff';
  ctx.font = '600 24px Segoe UI';
  ctx.fillText('Validação digital', 108, 1022);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px Segoe UI';
  ctx.fillText('Escaneie o QR code para validar', 108, 1076);

  ctx.fillStyle = '#9aa0bc';
  ctx.font = '400 22px Segoe UI';
  ctx.fillText('O código abre a página pública autenticada deste comprovante.', 108, 1118);
  ctx.fillText('Use a câmera do celular ou um leitor QR em boa iluminação.', 108, 1152);

  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  roundRect(ctx, 768, 996, 188, 188, 24);
  ctx.fill();

  ctx.strokeStyle = 'rgba(21,23,43,0.10)';
  ctx.lineWidth = 2;
  roundRect(ctx, 768, 996, 188, 188, 24);
  ctx.stroke();

  ctx.drawImage(qrImage, 782, 1010, 160, 160);

  ctx.fillStyle = '#8087a7';
  ctx.font = '400 22px Segoe UI';
  ctx.fillText(`Gerado em ${getAgoraSP().setLocale('pt-BR').toFormat("dd/MM/yyyy 'às' HH:mm:ss")}`, 108, 1240);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `comprovante-ponto-${ponto.date.substring(0, 10)}.png`;
  link.click();
}

export function PontoPage() {
  const { data: pontoHoje, isLoading } = usePontoHoje();
  const baterPonto = useBaterPonto();
  const currentUser = useAuthStore((state) => state.user);
  const [currentTime, setCurrentTime] = useState(getAgoraSP());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isGeneratingTicket, setIsGeneratingTicket] = useState(false);
  const lastTicketIdRef = useRef<string | null>(null);

  const funcionarioComprovante = useMemo<ComprovanteFuncionario>(() => ({
    nome: currentUser?.name ?? pontoHoje?.user?.name ?? '',
    id: currentUser?.id ?? pontoHoje?.userId ?? '',
    loja: currentUser?.loja ?? pontoHoje?.user?.loja ?? null,
  }), [currentUser, pontoHoje]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getAgoraSP()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hoje = new Date();
  const monthStart = format(startOfMonth(hoje), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(hoje), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: historicoSemanal, isLoading: loadingHistorico } = useRelatorio({
    startDate: weekStart,
    endDate: weekEnd,
  });

  const { data: historicoMensal } = useRelatorio({
    startDate: monthStart,
    endDate: monthEnd,
  });

  const { data: metricas } = usePontoMetricas({
    startDate: monthStart,
    endDate: monthEnd,
  });

  const btnState = getButtonState(pontoHoje);
  const BtnIcon = btnState.icon;
  const workingStatus = getWorkingStatus(pontoHoje);
  const horasHoje = pontoHoje ? calcularHoras(pontoHoje) : null;
  const horasEmCurso = pontoHoje && !pontoHoje.saida ? calcularHorasEmCurso(pontoHoje) : null;

  const hours = currentTime.toFormat('HH');
  const minutes = currentTime.toFormat('mm');
  const seconds = currentTime.toFormat('ss');

  const stepsCompleted = pontoHoje
    ? [pontoHoje.entrada, pontoHoje.almoco, pontoHoje.retorno, pontoHoje.saida].filter(Boolean).length
    : 0;
  const stepsProgressPct = Math.round((stepsCompleted / 4) * 100);
  const nextStepLabel =
    stepsCompleted === 0
      ? 'Próximo: entrada'
      : stepsCompleted === 1
        ? 'Próximo: saída almoço'
        : stepsCompleted === 2
          ? 'Próximo: retorno'
          : stepsCompleted === 3
            ? 'Próximo: saída'
            : 'Fluxo completo';

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(hoje);
    const firstDay = new Date(hoje.getFullYear(), hoje.getMonth(), 1).getDay();
    const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;

    const pontosMap = new Map<number, Ponto>();
    if (historicoMensal) {
      for (const ponto of historicoMensal) {
        const day = parseInt(ponto.date.substring(8, 10), 10);
        pontosMap.set(day, ponto);
      }
    }

    const days: Array<{ day: number; status: 'complete' | 'late' | 'absent' | 'auto' | 'weekend' | 'future' | null; tooltip: string }> = [];

    for (let index = 0; index < adjustedFirst; index++) {
      days.push({ day: 0, status: null, tooltip: '' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(hoje.getFullYear(), hoje.getMonth(), day);
      const dayOfWeek = date.getDay();
      const isFuture = date > hoje;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isFuture) {
        days.push({ day, status: 'future', tooltip: '' });
        continue;
      }

      const ponto = pontosMap.get(day);

      if (isWeekend && (!ponto || !ponto.entrada)) {
        days.push({ day, status: 'weekend', tooltip: 'Fim de semana' });
        continue;
      }

      if (!ponto || !ponto.entrada) {
        days.push({ day, status: 'absent', tooltip: 'Falta' });
      } else if (ponto.encerramentoAutomatico) {
        days.push({ day, status: 'auto', tooltip: `${fmtTime(ponto.entrada)} → 22:00 (auto)` });
      } else if (ponto.saida) {
        const horas = calcularHoras(ponto) ?? '';
        days.push({ day, status: 'complete', tooltip: `${fmtTime(ponto.entrada)} → ${fmtTime(ponto.saida)} | ${horas}` });
      } else {
        days.push({ day, status: 'late', tooltip: `${fmtTime(ponto.entrada)} → em curso` });
      }
    }

    return days;
  }, [historicoMensal, hoje]);

  const horasEsperadas = 176;
  const horasMinutosMatch = metricas?.totalHorasTrabalhadas.match(/(\d+)h(\d+)m/);
  const horasTrabalhadasNum = horasMinutosMatch
    ? parseInt(horasMinutosMatch[1]!, 10) + parseInt(horasMinutosMatch[2]!, 10) / 60
    : 0;
  const horasProgressPct = horasEsperadas > 0 ? Math.min(100, Math.round((horasTrabalhadasNum / horasEsperadas) * 100)) : 0;

  function getProgressColor(pct: number): string {
    if (pct > 100) return 'linear-gradient(90deg, var(--blue), #2196e0)';
    if (pct >= 80) return 'linear-gradient(90deg, var(--green), #1ab87e)';
    if (pct >= 50) return 'linear-gradient(90deg, var(--yellow), #e0a800)';
    return 'linear-gradient(90deg, var(--red), #c03030)';
  }

  const streakBadge = metricas ? getStreakBadge(metricas.streakAtual) : null;
  const pontualidadeBadge = metricas ? getPontualidadeBadge(metricas.percentualPontualidade) : null;
  const totalRegistrosMes = historicoMensal?.filter((ponto) => ponto.entrada).length ?? 0;

  const selectedPonto = useMemo(() => {
    if (!historicoMensal || selectedDay === null) return null;
    return historicoMensal.find((ponto) => parseInt(ponto.date.substring(8, 10), 10) === selectedDay) ?? null;
  }, [historicoMensal, selectedDay]);

  useEffect(() => {
    if (!historicoMensal?.length) {
      setSelectedDay(null);
      return;
    }

    if (selectedDay !== null && historicoMensal.some((ponto) => parseInt(ponto.date.substring(8, 10), 10) === selectedDay)) {
      return;
    }

    const todayRecord = historicoMensal.find((ponto) => parseInt(ponto.date.substring(8, 10), 10) === hoje.getDate());
    const fallback = todayRecord ?? historicoMensal[historicoMensal.length - 1];
    if (!fallback) {
      setSelectedDay(null);
      return;
    }
    setSelectedDay(parseInt(fallback.date.substring(8, 10), 10));
  }, [historicoMensal, hoje, selectedDay]);

  const baixarComprovante = async (ponto: Ponto, funcionario: ComprovanteFuncionario) => {
    setIsGeneratingTicket(true);
    try {
      const { urlValidacao } = await pontosApi.gerarTokenComprovante(ponto.id);
      await gerarComprovantePng(ponto, funcionario, urlValidacao);
      return true;
    } catch (error) {
      console.error('Erro ao gerar comprovante com QR code', error);
      return false;
    } finally {
      setIsGeneratingTicket(false);
    }
  };

  useEffect(() => {
    const pontoRegistrado = baterPonto.data;
    if (!pontoRegistrado?.saida) return;
    if (lastTicketIdRef.current === pontoRegistrado.id) return;

    lastTicketIdRef.current = pontoRegistrado.id;
    void (async () => {
      const generated = await baixarComprovante(pontoRegistrado, {
        nome: currentUser?.name ?? pontoRegistrado.user?.name ?? '',
        id: currentUser?.id ?? pontoRegistrado.userId,
        loja: currentUser?.loja ?? pontoRegistrado.user?.loja ?? null,
      });

      if (!generated) {
        lastTicketIdRef.current = null;
      }
    })();
  }, [baterPonto.data, currentUser]);

  return (
    <>
      <Topbar
        title="Registro de Ponto"
        subtitle={format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      />

      <div className="page-wrapper ponto-page">
        <section className="ponto-metrics-row">
          {metricas && (
            <>
              <div className="ponto-metric-card ponto-metric-streak">
                <div className="ponto-metric-icon-wrap" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
                  <Flame size={18} />
                </div>
                <div className="ponto-metric-main">
                  <span className="ponto-metric-number" style={{ color: 'var(--orange)' }}>
                    {metricas.streakAtual}
                  </span>
                  <span className="ponto-metric-label">dias consecutivos</span>
                </div>
                {streakBadge && (
                  <span className="ponto-streak-badge" style={{ color: streakBadge.color }}>
                    {streakBadge.emoji} {streakBadge.label}
                  </span>
                )}
              </div>

              <div className="ponto-metric-card">
                <div className="ponto-metric-icon-wrap" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                  <BarChart3 size={18} />
                </div>
                <div className="ponto-metric-main">
                  <span className="ponto-metric-number" style={{ color: 'var(--accent)' }}>
                    {metricas.totalHorasTrabalhadas}
                  </span>
                  <span className="ponto-metric-label">horas no mês</span>
                </div>
                <div className="ponto-metric-progress">
                  <div className="ponto-metric-progress-bar">
                    <div
                      className="ponto-metric-progress-fill"
                      style={{ width: `${horasProgressPct}%`, background: getProgressColor(horasProgressPct) }}
                    />
                  </div>
                  <span className="ponto-metric-progress-text">{horasProgressPct}% de ~{horasEsperadas}h</span>
                </div>
              </div>

              <div className="ponto-metric-card">
                <div className="ponto-metric-icon-wrap" style={{ background: pontualidadeBadge?.dimColor ?? 'var(--green-dim)', color: pontualidadeBadge?.color ?? 'var(--green)' }}>
                  <Target size={18} />
                </div>
                <div className="ponto-metric-main">
                  <span className="ponto-metric-number" style={{ color: pontualidadeBadge?.color ?? 'var(--green)' }}>
                    {metricas.percentualPontualidade}%
                  </span>
                  <span className="ponto-metric-label">pontualidade</span>
                </div>
                {pontualidadeBadge && (
                  <span className="ponto-pontualidade-badge" style={{ background: pontualidadeBadge.dimColor, color: pontualidadeBadge.color }}>
                    {pontualidadeBadge.label}
                  </span>
                )}
              </div>
            </>
          )}

          <div className="ponto-metric-card ponto-metric-card-compact">
            <div className="ponto-metric-icon-wrap" style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}>
              <Clock size={16} />
            </div>
            <div className="ponto-metric-main">
              <span className="ponto-metric-number" style={{ color: 'var(--accent)' }}>
                {horasHoje ?? horasEmCurso ?? '—'}
              </span>
              <span className="ponto-metric-label">horas hoje</span>
            </div>
            {horasEmCurso && !horasHoje && <span className="ponto-mini-badge">em curso</span>}
          </div>

          <div className="ponto-metric-card ponto-metric-card-compact">
            <div className="ponto-metric-icon-wrap" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
              <Timer size={16} />
            </div>
            <div className="ponto-metric-main">
              <span className="ponto-metric-number">{stepsCompleted}/4</span>
              <span className="ponto-metric-label">progresso</span>
            </div>
            <div className="ponto-metric-progress ponto-metric-progress-steps">
              <div className="ponto-metric-progress-bar ponto-metric-progress-bar-compact">
                <div
                  className="ponto-metric-progress-fill"
                  style={{ width: `${stepsProgressPct}%`, background: 'linear-gradient(90deg, var(--accent), #8c7dff)' }}
                />
              </div>
              <span className="ponto-metric-progress-text">{nextStepLabel}</span>
            </div>
            <div className="ponto-progress-dots ponto-progress-dots-inline">
              {[0, 1, 2, 3].map((index) => {
                const progressItem = TIMELINE_ITEMS[index];
                const progressColor = progressItem?.color ?? 'var(--accent)';

                return (
                  <span
                    key={index}
                    className="ponto-progress-dot"
                    style={{
                      background: index < stepsCompleted ? progressColor : 'var(--bg4)',
                      boxShadow: index < stepsCompleted ? `0 0 6px ${progressColor}` : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <div className="ponto-layout-grid">
          <section className="ponto-clock-section ponto-grid-panel ponto-grid-clock">
            <div className="ponto-clock-shell">
              <div className="ponto-clock-main">
                <div className="ponto-clock-display">
                  <span className="ponto-digit">{hours}</span>
                  <span className="ponto-separator">:</span>
                  <span className="ponto-digit">{minutes}</span>
                  <span className="ponto-separator">:</span>
                  <span className="ponto-digit-sec">{seconds}</span>
                </div>

                <div className="ponto-date-row">
                  <Calendar size={14} />
                  <span>{currentTime.setLocale('pt-BR').toFormat("cccc, dd 'de' MMMM 'de' yyyy")}</span>
                </div>

                {workingStatus && (
                  <div className="ponto-status-pill">
                    <span
                      className="ponto-status-dot"
                      style={{
                        backgroundColor: workingStatus.dotColor,
                        boxShadow: `0 0 8px ${workingStatus.dotColor}`,
                      }}
                    />
                    {workingStatus.label}
                  </div>
                )}

                {!isLoading && (
                  <button
                    onClick={() => baterPonto.mutate()}
                    disabled={btnState.disabled || baterPonto.isPending}
                    className="ponto-action-btn"
                    style={{
                      background: btnState.bg ?? btnState.gradient,
                      color: btnState.color,
                      boxShadow: btnState.disabled ? 'none' : `0 6px 24px ${btnState.shadow}`,
                      opacity: baterPonto.isPending ? 0.7 : 1,
                    }}
                  >
                    <BtnIcon size={18} />
                    {baterPonto.isPending ? 'Registrando...' : btnState.label}
                  </button>
                )}

              </div>

              {pontoHoje?.saida && (
                <button
                  className="ponto-ticket-btn"
                  onClick={() => void baixarComprovante(pontoHoje, funcionarioComprovante)}
                  disabled={isGeneratingTicket}
                >
                  <Download size={16} />
                  {isGeneratingTicket ? 'Gerando comprovante...' : 'Baixar comprovante PNG'}
                </button>
              )}

              <div className="ponto-section-divider" />

              <div className="ponto-inline-register">
                <div className="ponto-card-header ponto-card-header-inline">
                  <Clock size={16} />
                  <span>Registro de hoje</span>
                  <span className="ponto-header-hint">4 momentos</span>
                </div>
                <div className="ponto-timeline ponto-timeline-cards">
                  {isLoading ? (
                    [1, 2, 3, 4].map((item) => <div key={item} className="skeleton" style={{ height: 92, borderRadius: 16 }} />)
                  ) : (
                    TIMELINE_ITEMS.map((item) => {
                      const timeVal = pontoHoje?.[item.key] ?? null;
                      const filled = !!timeVal;
                      const Icon = item.icon;

                      return (
                        <div key={item.key} className={`ponto-timeline-card${filled ? ' is-filled' : ''}`}>
                          <div
                            className="ponto-timeline-icon"
                            style={{
                              background: filled ? item.dimColor : 'var(--bg4)',
                              color: filled ? item.color : 'var(--text3)',
                              border: filled ? `1px solid ${item.color}` : '1.5px dashed var(--border2)',
                            }}
                          >
                            <Icon size={14} />
                          </div>
                          <div className="ponto-timeline-content">
                            <span className="ponto-timeline-label">{item.label}</span>
                            <span className="ponto-timeline-time" style={{ color: filled ? item.color : 'var(--text3)' }}>
                              {filled ? fmtTime(timeVal) : '—'}
                            </span>
                            <span className="ponto-timeline-note">{filled ? 'registrado' : 'aguardando'}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Calendário — fora do grid, sempre abaixo do relógio */}
        <section className="ponto-card ponto-grid-calendar">
            <div className="ponto-card-header">
              <Calendar size={16} />
              <span>{format(hoje, 'MMMM yyyy', { locale: ptBR })}</span>
              <span className="ponto-header-count">{totalRegistrosMes}</span>
            </div>
            <div className="ponto-calendar">
              <div className="ponto-cal-header">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
                  <span key={day} className="ponto-cal-day-label">{day}</span>
                ))}
              </div>
              <div className="ponto-cal-grid">
                {calendarDays.map((cell, index) => {
                  if (cell.day === 0) return <span key={index} className="ponto-cal-empty" />;

                  const isToday = cell.day === hoje.getDate();
                  const clickable = !!cell.status && cell.status !== 'future' && cell.status !== 'weekend';

                  return (
                    <button
                      type="button"
                      key={index}
                      className={`ponto-cal-cell ponto-cal-${cell.status}${isToday ? ' ponto-cal-today' : ''}${selectedDay === cell.day ? ' ponto-cal-selected' : ''}${clickable ? ' is-clickable' : ''}`}
                      title={cell.tooltip}
                      disabled={!clickable}
                      onClick={() => setSelectedDay(cell.day)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
              <div className="ponto-cal-legend">
                <span className="ponto-cal-legend-item"><span className="ponto-cal-dot" style={{ background: 'var(--green)' }} /> Completo</span>
                <span className="ponto-cal-legend-item"><span className="ponto-cal-dot" style={{ background: 'var(--yellow)' }} /> Parcial</span>
                <span className="ponto-cal-legend-item"><span className="ponto-cal-dot" style={{ background: 'var(--red)' }} /> Falta</span>
                <span className="ponto-cal-legend-item"><span className="ponto-cal-dot" style={{ background: 'var(--accent)' }} /> Enc. Auto</span>
              </div>
            </div>
        </section>

        <div className="ponto-detail-history-grid">
          <section className="ponto-card ponto-grid-panel ponto-grid-detail">
            <div className="ponto-card-header">
              <Sparkles size={15} />
              <span>Detalhes do dia</span>
              {selectedPonto && <span className="ponto-header-hint">selecionado</span>}
            </div>
            <div className="ponto-day-detail ponto-day-detail-standalone">
              <div className="ponto-day-detail-head">
                <span className="ponto-day-detail-date">
                  {selectedPonto
                    ? format(parseDateOnly(selectedPonto.date).toJSDate(), "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : 'Selecione um dia com registro'}
                </span>
              </div>

              {selectedPonto ? (
                <>
                  <div className="ponto-day-detail-highlight">
                    <span className="ponto-day-detail-highlight-label">Total trabalhado</span>
                    <strong>{calcularHoras(selectedPonto) ?? calcularHorasEmCurso(selectedPonto) ?? '—'}</strong>
                    <span className="ponto-day-detail-highlight-status">{getPontoStatusLabel(selectedPonto).label}</span>
                  </div>
                  <div className="ponto-day-detail-grid">
                    {TIMELINE_ITEMS.map((item) => (
                      <div key={item.key} className="ponto-day-detail-item">
                        <span className="ponto-day-detail-label">{item.label}</span>
                        <strong>{fmtTime(selectedPonto[item.key] ?? null)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="ponto-day-detail-footer">
                    <span>Entrada e saída em visão rápida</span>
                    <span>{selectedPonto.encerramentoAutomatico ? 'Encerramento automático' : 'Registro manual'}</span>
                  </div>
                </>
              ) : (
                <span className="ponto-day-detail-empty">Clique em um dia do calendário para ver os horários e o resumo do expediente.</span>
              )}
            </div>
          </section>

          <section className="ponto-card ponto-card-history ponto-grid-panel ponto-grid-history">
            <div className="ponto-card-header">
              <Calendar size={16} />
              <span>Histórico da Semana</span>
              {historicoSemanal && historicoSemanal.length > 0 && (
                <span className="ponto-header-count">{historicoSemanal.length}</span>
              )}
            </div>

            {loadingHistorico ? (
              <div className="ponto-card-body ponto-week-cards">
                {[1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton" style={{ height: 120, borderRadius: 18 }} />)}
              </div>
            ) : !historicoSemanal || historicoSemanal.length === 0 ? (
              <div className="ponto-card-body ponto-empty">
                <Calendar size={32} />
                <span>Nenhum registro nesta semana</span>
              </div>
            ) : (
              <div className="ponto-card-body ponto-week-cards">
                {historicoSemanal.map((ponto) => {
                  const horas = calcularHoras(ponto);
                  const status = getPontoStatusLabel(ponto);
                  const pontoDateStr = ponto.date.substring(0, 10);
                  const isToday = pontoDateStr === getAgoraSP().toFormat('yyyy-MM-dd');
                  const date = parseDateOnly(ponto.date);
                  const dayLabel = format(date.toJSDate(), 'EEE, dd/MM', { locale: ptBR });

                  return (
                    <div key={ponto.id} className={`ponto-week-card${isToday ? ' is-today' : ''}`}>
                      <div className="ponto-week-card-head">
                        <div className="ponto-hist-day">
                          {isToday && <span className="ponto-today-dot" />}
                          <span className="ponto-hist-day-text">{dayLabel}</span>
                        </div>
                        <span
                          className="ponto-hist-status"
                          style={{
                            background: status.label === 'Completo' ? 'var(--green-dim)' : status.label === 'Parcial' ? 'var(--yellow-dim)' : 'var(--red-dim)',
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="ponto-week-card-grid">
                        {TIMELINE_ITEMS.map((item) => (
                          <div key={item.key} className="ponto-week-card-slot">
                            <span>{item.label}</span>
                            <strong>{fmtTime(ponto[item.key] ?? null)}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="ponto-week-card-footer">
                        <span className="ponto-hist-hours">{horas ?? '—'}</span>
                        {ponto.encerramentoAutomatico && (
                          <span className="ponto-week-auto">Encerramento automático</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>{/* fecha ponto-detail-history-grid */}
      </div>
    </>
  );
}
