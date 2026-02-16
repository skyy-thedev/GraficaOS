import { Topbar } from '@/components/layout/Topbar';
import { usePontoHoje, useBaterPonto, useRelatorio } from '@/hooks/usePonto';
import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Calendar, Timer, LogIn, Coffee, RotateCcw, LogOut, CheckCircle } from 'lucide-react';
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
  const weekStart = format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: historicoSemanal, isLoading: loadingHistorico } = useRelatorio({
    startDate: weekStart,
    endDate: weekEnd,
  });

  const btnState = getButtonState(pontoHoje);
  const BtnIcon = btnState.icon;
  const workingStatus = getWorkingStatus(pontoHoje);
  const horasHoje = pontoHoje ? calcularHoras(pontoHoje) : null;
  const horasEmCurso = pontoHoje && !pontoHoje.saida ? calcularHorasEmCurso(pontoHoje) : null;

  const hours = format(currentTime, 'HH');
  const minutes = format(currentTime, 'mm');
  const seconds = format(currentTime, 'ss');

  // Contagem de etapas completadas
  const stepsCompleted = pontoHoje
    ? [pontoHoje.entrada, pontoHoje.almoco, pontoHoje.retorno, pontoHoje.saida].filter(Boolean).length
    : 0;

  return (
    <>
      <Topbar
        title="Registro de Ponto"
        subtitle={format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      />

      <div className="page-wrapper ponto-page">

        {/* ===== SEÇÃO 1: Relógio + Ação ===== */}
        <section className="ponto-clock-section">
          {/* Relógio */}
          <div className="ponto-clock-display">
            <span className="ponto-digit">{hours}</span>
            <span className="ponto-separator">:</span>
            <span className="ponto-digit">{minutes}</span>
            <span className="ponto-separator">:</span>
            <span className="ponto-digit-sec">{seconds}</span>
          </div>

          {/* Data */}
          <div className="ponto-date-row">
            <Calendar size={14} />
            <span>{format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
          </div>

          {/* Status */}
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

          {/* Botão */}
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
                    background: i < stepsCompleted ? TIMELINE_ITEMS[i].color : 'var(--bg4)',
                    boxShadow: i < stepsCompleted ? `0 0 6px ${TIMELINE_ITEMS[i].color}` : 'none',
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
                    {/* Ícone */}
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

                    {/* Label */}
                    <span className="ponto-timeline-label">{item.label}</span>

                    {/* Hora */}
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

        {/* ===== SEÇÃO 4: Histórico Semanal ===== */}
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
                    {/* Dia */}
                    <div className="ponto-hist-day">
                      {isToday && <span className="ponto-today-dot" />}
                      <span className="ponto-hist-day-text">{dayLabel}</span>
                    </div>

                    {/* Horários */}
                    <div className="ponto-hist-times">
                      <span style={{ color: p.entrada ? 'var(--green)' : 'var(--text3)' }}>{fmtTime(p.entrada)}</span>
                      <span className="ponto-hist-sep">→</span>
                      <span style={{ color: p.saida ? 'var(--red)' : 'var(--text3)' }}>{fmtTime(p.saida)}</span>
                    </div>

                    {/* Horas + Status */}
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
