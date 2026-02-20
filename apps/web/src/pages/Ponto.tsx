import { Topbar } from '@/components/layout/Topbar';
import { usePontoHoje, useBaterPonto, useRelatorio, usePontoMetricas } from '@/hooks/usePonto';
import { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock, Calendar, Timer, LogIn, Coffee, RotateCcw, LogOut, CheckCircle,
  Flame, BarChart3, Target, Briefcase,
} from 'lucide-react';
import type { Ponto } from '@/types';

// ===== Helpers =====

function calcularHoras(ponto: Ponto): string | null {
  if (!ponto.entrada || !ponto.saida) return null;
  let totalMs = new Date(ponto.saida).getTime() - new Date(ponto.entrada).getTime();
  if (ponto.almoco && ponto.retorno) {
    totalMs -= new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
  }
  const totalMinutes = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}m`;
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
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}m`;
}

function getPontoStatusLabel(p: Ponto): { label: string; color: string } {
  if (p.saida) return { label: 'Completo', color: 'var(--green)' };
  if (p.entrada) return { label: 'Parcial', color: 'var(--yellow)' };
  return { label: 'Falta', color: 'var(--red)' };
}

function getButtonState(pontoHoje: Ponto | null | undefined) {
  if (!pontoHoje || !pontoHoje.entrada) {
    return { label: 'Registrar Entrada', icon: LogIn, gradient: 'linear-gradient(135deg, #22d3a0, #1ab87e)', shadow: 'rgba(34,211,160,0.25)', color: '#fff', disabled: false };
  }
  if (!pontoHoje.almoco) {
    return { label: 'Saída Almoço', icon: Coffee, gradient: 'linear-gradient(135deg, #f5c542, #e0a800)', shadow: 'rgba(245,197,66,0.25)', color: '#0a0a0f', disabled: false };
  }
  if (!pontoHoje.retorno) {
    return { label: 'Retorno Almoço', icon: RotateCcw, gradient: 'linear-gradient(135deg, #4db8ff, #2196e0)', shadow: 'rgba(77,184,255,0.25)', color: '#fff', disabled: false };
  }
  if (!pontoHoje.saida) {
    return { label: 'Registrar Saída', icon: LogOut, gradient: 'linear-gradient(135deg, #ff5e5e, #e03030)', shadow: 'rgba(255,94,94,0.25)', color: '#fff', disabled: false };
  }
  return { label: 'Expediente Encerrado', icon: CheckCircle, gradient: 'none', shadow: 'none', color: 'var(--text3)', disabled: true, bg: 'var(--bg3)' };
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
  return format(new Date(dateStr), 'HH:mm');
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

const TIMELINE_ITEMS = [
  { key: 'entrada' as const, label: 'Entrada', icon: LogIn, color: 'var(--green)', dimColor: 'var(--green-dim)' },
  { key: 'almoco' as const, label: 'Saída Almoço', icon: Coffee, color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' },
  { key: 'retorno' as const, label: 'Retorno', icon: RotateCcw, color: 'var(--blue)', dimColor: 'var(--blue-dim)' },
  { key: 'saida' as const, label: 'Saída', icon: LogOut, color: 'var(--red)', dimColor: 'var(--red-dim)' },
];

// ===== Componente principal =====
export function PontoPage() {
  const { data: pontoHoje, isLoading } = usePontoHoje();
  const baterPonto = useBaterPonto();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
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

  const hours = format(currentTime, 'HH');
  const minutes = format(currentTime, 'mm');
  const seconds = format(currentTime, 'ss');

  const stepsCompleted = pontoHoje
    ? [pontoHoje.entrada, pontoHoje.almoco, pontoHoje.retorno, pontoHoje.saida].filter(Boolean).length
    : 0;

  // Calendário mensal
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(hoje);
    const firstDay = new Date(hoje.getFullYear(), hoje.getMonth(), 1).getDay();
    const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;

    const pontosMap = new Map<number, Ponto>();
    if (historicoMensal) {
      for (const p of historicoMensal) {
        const d = new Date(p.date).getDate();
        pontosMap.set(d, p);
      }
    }

    const days: Array<{
      day: number;
      status: 'complete' | 'late' | 'absent' | 'auto' | 'weekend' | 'future' | null;
      tooltip: string;
    }> = [];

    for (let i = 0; i < adjustedFirst; i++) {
      days.push({ day: 0, status: null, tooltip: '' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(hoje.getFullYear(), hoje.getMonth(), d);
      const dayOfWeek = date.getDay();
      const isFuture = date > hoje;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isFuture) {
        days.push({ day: d, status: 'future', tooltip: '' });
        continue;
      }

      const ponto = pontosMap.get(d);

      // Se é fim de semana sem registro, mostra como weekend
      if (isWeekend && (!ponto || !ponto.entrada)) {
        days.push({ day: d, status: 'weekend', tooltip: 'Fim de semana' });
        continue;
      }

      if (!ponto || !ponto.entrada) {
        days.push({ day: d, status: 'absent', tooltip: 'Falta' });
      } else if (ponto.encerramentoAutomatico) {
        const tt = `${fmtTime(ponto.entrada)} → 22:00 (auto)`;
        days.push({ day: d, status: 'auto', tooltip: tt });
      } else if (ponto.saida) {
        const horas = calcularHoras(ponto) ?? '';
        const tt = `${fmtTime(ponto.entrada)} → ${fmtTime(ponto.saida)} | ${horas}`;
        days.push({ day: d, status: 'complete', tooltip: tt });
      } else {
        const tt = `${fmtTime(ponto.entrada)} → em curso`;
        days.push({ day: d, status: 'late', tooltip: tt });
      }
    }

    return days;
  }, [hoje, historicoMensal]);

  // Horas esperadas (22 dias úteis × 8h = 176h)
  const horasEsperadas = 176;
  const horasMinutosMatch = metricas?.totalHorasTrabalhadas.match(/(\d+)h(\d+)m/);
  const horasTrabalhadasNum = horasMinutosMatch ? parseInt(horasMinutosMatch[1]!) + parseInt(horasMinutosMatch[2]!) / 60 : 0;
  const horasProgressPct = horasEsperadas > 0 ? Math.min(100, Math.round((horasTrabalhadasNum / horasEsperadas) * 100)) : 0;

  function getProgressColor(pct: number): string {
    if (pct > 100) return 'linear-gradient(90deg, var(--blue), #2196e0)';
    if (pct >= 80) return 'linear-gradient(90deg, var(--green), #1ab87e)';
    if (pct >= 50) return 'linear-gradient(90deg, var(--yellow), #e0a800)';
    return 'linear-gradient(90deg, var(--red), #c03030)';
  }

  const streakBadge = metricas ? getStreakBadge(metricas.streakAtual) : null;
  const pontualidadeBadge = metricas ? getPontualidadeBadge(metricas.percentualPontualidade) : null;

  return (
    <>
      <Topbar
        title="Registro de Ponto"
        subtitle={format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      />

      <div className="page-wrapper ponto-page">

        {/* ===== SEÇÃO 0: Métricas Motivacionais ===== */}
        {metricas && (
          <section className="ponto-metrics-row">
            {/* Streak */}
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

            {/* Horas no mês */}
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

            {/* Pontualidade */}
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
                <span
                  className="ponto-pontualidade-badge"
                  style={{ background: pontualidadeBadge.dimColor, color: pontualidadeBadge.color }}
                >
                  {pontualidadeBadge.label}
                </span>
              )}
            </div>
          </section>
        )}

        {/* ===== SEÇÃO 1: Relógio + Ação ===== */}
        <section className="ponto-clock-section">
          <div className="ponto-clock-display">
            <span className="ponto-digit">{hours}</span>
            <span className="ponto-separator">:</span>
            <span className="ponto-digit">{minutes}</span>
            <span className="ponto-separator">:</span>
            <span className="ponto-digit-sec">{seconds}</span>
          </div>

          <div className="ponto-date-row">
            <Calendar size={14} />
            <span>{format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
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

          {/* Horários definidos */}
          <div className="ponto-schedule-info">
            <Briefcase size={13} />
            <div className="ponto-schedule-options">
              <span className="ponto-schedule-group">
                <span className="ponto-schedule-label">Entrada:</span>
                <span className="ponto-schedule-tag">10h</span>
                <span className="ponto-schedule-tag ponto-schedule-tag-alt" title="Domingos e feriados">12h<sup>*</sup></span>
                <span className="ponto-schedule-tag">13h</span>
              </span>
              <span className="ponto-schedule-sep">|</span>
              <span className="ponto-schedule-group">
                <span className="ponto-schedule-label">Saída:</span>
                <span className="ponto-schedule-tag">18h30</span>
                <span className="ponto-schedule-tag ponto-schedule-tag-alt" title="Domingos e feriados">20h<sup>*</sup></span>
                <span className="ponto-schedule-tag">22h</span>
              </span>
            </div>
          </div>
        </section>

        {/* ===== SEÇÃO 2: Cards de Resumo ===== */}
        <section className="ponto-summary-row">
          <div className="ponto-mini-card">
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            <div className="ponto-mini-info">
              <span className="ponto-mini-label">Horas hoje</span>
              <span className="ponto-mini-value" style={{ color: 'var(--accent)' }}>
                {horasHoje ?? horasEmCurso ?? '—'}
              </span>
            </div>
            {horasEmCurso && !horasHoje && (
              <span className="ponto-mini-badge">em curso</span>
            )}
          </div>

          <div className="ponto-mini-card">
            <Timer size={16} style={{ color: 'var(--text2)' }} />
            <div className="ponto-mini-info">
              <span className="ponto-mini-label">Progresso</span>
              <span className="ponto-mini-value">{stepsCompleted}/4</span>
            </div>
            <div className="ponto-progress-dots">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="ponto-progress-dot"
                  style={{
                    background: i < stepsCompleted ? (TIMELINE_ITEMS[i]?.color ?? 'var(--bg4)') : 'var(--bg4)',
                    boxShadow: i < stepsCompleted ? `0 0 6px ${TIMELINE_ITEMS[i]?.color ?? 'transparent'}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ===== SEÇÃO 3: Timeline do dia ===== */}
        <section className="ponto-card">
          <div className="ponto-card-header">
            <Clock size={16} />
            <span>Registro de hoje</span>
          </div>
          <div className="ponto-timeline">
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" style={{ height: 52 }} />
              ))
            ) : (
              TIMELINE_ITEMS.map((item, idx) => {
                const timeVal = pontoHoje?.[item.key] ?? null;
                const filled = !!timeVal;
                const Icon = item.icon;

                return (
                  <div key={item.key} className={`ponto-timeline-item${idx < 3 ? ' ponto-timeline-divider' : ''}`}>
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
                    <span className="ponto-timeline-label">{item.label}</span>
                    <span
                      className="ponto-timeline-time"
                      style={{ color: filled ? item.color : 'var(--text3)' }}
                    >
                      {filled ? fmtTime(timeVal) : '—'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ===== SEÇÃO 4: Calendário Mensal ===== */}
        <section className="ponto-card">
          <div className="ponto-card-header">
            <Calendar size={16} />
            <span>{format(hoje, "MMMM yyyy", { locale: ptBR })}</span>
          </div>
          <div className="ponto-calendar">
            <div className="ponto-cal-header">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <span key={d} className="ponto-cal-day-label">{d}</span>
              ))}
            </div>
            <div className="ponto-cal-grid">
              {calendarDays.map((cell, i) => {
                if (cell.day === 0) return <span key={i} className="ponto-cal-empty" />;

                const isToday = cell.day === hoje.getDate();

                return (
                  <span
                    key={i}
                    className={`ponto-cal-cell ponto-cal-${cell.status}${isToday ? ' ponto-cal-today' : ''}`}
                    title={cell.tooltip}
                  >
                    {cell.day}
                  </span>
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

        {/* ===== SEÇÃO 5: Histórico Semanal ===== */}
        <section className="ponto-card">
          <div className="ponto-card-header">
            <Calendar size={16} />
            <span>Histórico da Semana</span>
            {historicoSemanal && historicoSemanal.length > 0 && (
              <span className="ponto-header-count">{historicoSemanal.length}</span>
            )}
          </div>

          {loadingHistorico ? (
            <div className="ponto-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton" style={{ height: 48 }} />
              ))}
            </div>
          ) : !historicoSemanal || historicoSemanal.length === 0 ? (
            <div className="ponto-card-body ponto-empty">
              <Calendar size={32} />
              <span>Nenhum registro nesta semana</span>
            </div>
          ) : (
            <div className="ponto-card-body ponto-hist-list">
              {historicoSemanal.map((p) => {
                const horas = calcularHoras(p);
                const status = getPontoStatusLabel(p);
                const isToday = new Date(p.date).toDateString() === new Date().toDateString();
                const dayLabel = format(new Date(p.date), "EEE, dd/MM", { locale: ptBR });

                return (
                  <div key={p.id} className={`ponto-hist-row${isToday ? ' ponto-hist-today' : ''}`}>
                    <div className="ponto-hist-day">
                      {isToday && <span className="ponto-today-dot" />}
                      <span className="ponto-hist-day-text">{dayLabel}</span>
                    </div>
                    <div className="ponto-hist-times">
                      <span style={{ color: p.entrada ? 'var(--green)' : 'var(--text3)' }}>{fmtTime(p.entrada)}</span>
                      <span className="ponto-hist-sep">→</span>
                      <span style={{ color: p.saida ? 'var(--red)' : 'var(--text3)' }}>{fmtTime(p.saida)}</span>
                    </div>
                    <div className="ponto-hist-meta">
                      <span className="ponto-hist-hours">{horas ?? '—'}</span>
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
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </>
  );
}
