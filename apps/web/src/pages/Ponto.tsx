import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePontoHoje, useBaterPonto, useRelatorio } from '@/hooks/usePonto';
import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Ponto } from '@/types';

// ===== Helpers =====

/** Calcula horas trabalhadas: (saída - entrada) - (retorno - almoço) */
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

/** Status do ponto */
function getPontoStatusLabel(p: Ponto): { label: string; color: string } {
  if (p.saida) return { label: 'Completo', color: 'var(--green)' };
  if (p.entrada) return { label: 'Parcial', color: 'var(--yellow)' };
  return { label: 'Falta', color: 'var(--red)' };
}

/** Estado do botão dinâmico */
function getButtonState(pontoHoje: Ponto | null | undefined) {
  if (!pontoHoje || !pontoHoje.entrada) {
    return {
      label: 'Registrar Entrada',
      gradient: 'linear-gradient(135deg, #22d3a0, #1ab87e)',
      shadow: 'rgba(34,211,160,0.3)',
      color: '#fff',
      disabled: false,
    };
  }
  if (!pontoHoje.almoco) {
    return {
      label: 'Saída para Almoço',
      gradient: 'linear-gradient(135deg, #f5c542, #e0a800)',
      shadow: 'rgba(245,197,66,0.3)',
      color: '#0a0a0f',
      disabled: false,
    };
  }
  if (!pontoHoje.retorno) {
    return {
      label: 'Retorno do Almoço',
      gradient: 'linear-gradient(135deg, #4db8ff, #2196e0)',
      shadow: 'rgba(77,184,255,0.3)',
      color: '#fff',
      disabled: false,
    };
  }
  if (!pontoHoje.saida) {
    return {
      label: 'Registrar Saída',
      gradient: 'linear-gradient(135deg, #ff5e5e, #e03030)',
      shadow: 'rgba(255,94,94,0.3)',
      color: '#fff',
      disabled: false,
    };
  }
  return {
    label: 'Expediente Encerrado',
    gradient: 'none',
    shadow: 'none',
    color: 'var(--text2)',
    disabled: true,
    bg: 'var(--bg4)',
  };
}

/** Status visual para "trabalhando agora" */
function getWorkingStatus(pontoHoje: Ponto | null | undefined): { label: string; dotColor: string } | null {
  if (!pontoHoje || !pontoHoje.entrada) return null;
  if (pontoHoje.saida) return { label: 'Expediente encerrado', dotColor: 'var(--green)' };
  if (pontoHoje.retorno) return { label: 'Trabalhando', dotColor: 'var(--green)' };
  if (pontoHoje.almoco) return { label: 'No almoço', dotColor: 'var(--yellow)' };
  return { label: 'Trabalhando', dotColor: 'var(--green)' };
}

/** Formata horário ou retorna '--:--' */
function fmtTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return format(new Date(dateStr), 'HH:mm');
}

/** Gera CSV a partir de pontos — moved to GestaoPontos.tsx */

// ===== Timeline item do dia =====
const TIMELINE_ITEMS = [
  { key: 'entrada' as const, label: 'Entrada', emoji: '🟢', color: 'var(--green)', dimColor: 'var(--green-dim)' },
  { key: 'almoco' as const, label: 'Saída Almoço', emoji: '🟡', color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' },
  { key: 'retorno' as const, label: 'Retorno', emoji: '🔵', color: 'var(--blue)', dimColor: 'var(--blue-dim)' },
  { key: 'saida' as const, label: 'Saída', emoji: '🔴', color: 'var(--red)', dimColor: 'var(--red-dim)' },
];

// ===== Componente principal =====
export function PontoPage() {
  const { data: pontoHoje, isLoading } = usePontoHoje();
  const baterPonto = useBaterPonto();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Relógio em tempo real
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Semana atual para histórico pessoal
  const hoje = new Date();
  const weekStart = format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const { data: historicoSemanal, isLoading: loadingHistorico } = useRelatorio({
    startDate: weekStart,
    endDate: weekEnd,
  });

  // Estado do botão
  const btnState = getButtonState(pontoHoje);
  const workingStatus = getWorkingStatus(pontoHoje);

  // Horas do dia
  const horasHoje = pontoHoje ? calcularHoras(pontoHoje) : null;

  // Formatação do relógio
  const hours = format(currentTime, 'HH');
  const minutes = format(currentTime, 'mm');
  const seconds = format(currentTime, 'ss');

  return (
    <>
      <Topbar
        title="Registro de Ponto"
        subtitle={format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}
      />

      <div className="page-wrapper p-7 flex flex-col gap-6">
        {/* ===== Hero: Relógio + Timeline ===== */}
        <div className="ponto-hero-grid grid gap-6">
          {/* Card Relógio */}
          <Card className="relative overflow-hidden">
            <div
              className="ponto-radial-bg absolute inset-0 pointer-events-none"
            />
            <CardContent className="relative flex flex-col items-center justify-center py-16 space-y-6">
              {/* Relógio grande */}
              <div className="ponto-clock flex items-baseline gap-0">
                <span className="text-primary">{hours}</span>
                <span className="text-accent2">:</span>
                <span className="text-primary">{minutes}</span>
                <span className="text-accent2">:</span>
                <span className="text-primary">{seconds}</span>
              </div>

              {/* Data */}
              <p className="ponto-date-text">
                {format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>

              {/* Botão dinâmico */}
              {!isLoading && (
                <button
                  onClick={() => baterPonto.mutate()}
                  disabled={btnState.disabled || baterPonto.isPending}
                  className="ponto-btn"
                  style={{
                    background: btnState.bg ?? btnState.gradient,
                    color: btnState.color,
                    boxShadow: btnState.disabled ? 'none' : `0 4px 20px ${btnState.shadow}`,
                    cursor: btnState.disabled ? 'default' : 'pointer',
                    opacity: baterPonto.isPending ? 0.7 : 1,
                  }}
                >
                  {baterPonto.isPending ? 'Registrando...' : btnState.label}
                </button>
              )}

              {/* Status trabalhando */}
              {workingStatus && (
                <div className="flex items-center gap-2 text-24 text-secondary">
                  <span
                    className="inline-block h-2 w-2 rounded-full animate-pulse-slow"
                    style={{
                      backgroundColor: workingStatus.dotColor,
                      boxShadow: `0 0 6px ${workingStatus.dotColor}`,
                    }}
                  />
                  {workingStatus.label}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Timeline do dia */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-18 text-primary font-semibold">
                Registro de hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {isLoading ? (
                <div className="space-y-4 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton h-12 w-full" />
                  ))}
                </div>
              ) : (
                TIMELINE_ITEMS.map((item, idx) => {
                  const timeVal = pontoHoje?.[item.key] ?? null;
                  const filled = !!timeVal;

                  return (
                    <div
                      key={item.key}
                      className={`flex items-center gap-3 py-3 ${idx < TIMELINE_ITEMS.length - 1 ? 'border-b-theme' : ''}`}
                    >
                      {/* Dot */}
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm shrink-0"
                        style={{
                          background: filled ? item.dimColor : 'var(--bg4)',
                          border: filled ? 'none' : '1.5px dashed var(--border2)',
                        } as React.CSSProperties}
                      >
                        {filled ? item.emoji : ''}
                      </div>

                      {/* Horário e label */}
                      <div className="flex-1">
                        <span
                          className="block text-sm text-muted font-mono"
                        >
                          {item.label}
                        </span>
                      </div>
                      <span
                        className="mono-14"
                        style={{ color: filled ? item.color : 'var(--text3)' }}
                      >
                        {filled ? fmtTime(timeVal) : 'Pendente'}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== 2B: Card de Resumo do Dia ===== */}
        <div className="ponto-summary-grid grid grid-cols-4 gap-4">
          {[
            { label: 'ENTRADA', value: fmtTime(pontoHoje?.entrada ?? null), color: 'var(--green)', dimColor: 'var(--green-dim)' },
            { label: 'ALMOÇO', value: fmtTime(pontoHoje?.almoco ?? null), color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' },
            { label: 'RETORNO', value: fmtTime(pontoHoje?.retorno ?? null), color: 'var(--blue)', dimColor: 'var(--blue-dim)' },
            { label: 'HORAS', value: horasHoje ?? (pontoHoje?.entrada ? 'em curso' : '—'), color: 'var(--accent)', dimColor: 'var(--accent-glow)' },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="py-4 px-5 text-center">
                <span
                  className="block text-18 mb-2 uppercase tracking-wider mono-label"
                >
                  {item.label}
                </span>
                <span
                  className="inline-block px-3 py-1 rounded-full font-medium font-mono text-24"
                  style={{
                    background: item.dimColor,
                    color: item.color,
                    border: `1px solid ${item.color}`,
                  }}
                >
                  {item.value}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ===== 2C: Histórico Semanal ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-24 text-primary font-semibold">
              Histórico da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistorico ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : !historicoSemanal || historicoSemanal.length === 0 ? (
              <p className="text-center py-8 text-muted text-24">
                Nenhum registro nesta semana.
              </p>
            ) : (
              <TabelaPontos pontos={historicoSemanal} showUser={false} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ===== Tabela reutilizável de pontos =====
function TabelaPontos({ pontos, showUser = false }: { pontos: Ponto[]; showUser?: boolean }) {
  return (
    <div className="table-wrapper overflow-x-auto">
      <table className="w-full text-left table-text">
        <thead>
          <tr className="table-header-row">
            {showUser && (
              <th className="py-2 pr-4 th-cell">
                Funcionário
              </th>
            )}
            <th className="py-2 pr-4 th-cell">Data</th>
            <th className="py-2 pr-4 th-cell">Entrada</th>
            <th className="py-2 pr-4 th-cell">Almoço</th>
            <th className="py-2 pr-4 th-cell">Retorno</th>
            <th className="py-2 pr-4 th-cell">Saída</th>
            <th className="py-2 pr-4 th-cell">Horas</th>
            <th className="py-2 th-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => {
            const horas = calcularHoras(p);
            const status = getPontoStatusLabel(p);
            const isToday = new Date(p.date).toDateString() === new Date().toDateString();

            return (
              <tr key={p.id} className="table-body-row">
                {showUser && (
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="bg-dynamic flex h-7 w-7 items-center justify-center rounded-full text-11 font-bold text-white shrink-0"
                        data-color={p.user.avatarColor}
                      >
                        {p.user.initials}
                      </div>
                      <span className="text-name">{p.user.name}</span>
                    </div>
                  </td>
                )}
                <td className="py-3 px-4 td-mono-text2">
                  {format(new Date(p.date), 'dd/MM')}
                </td>
                <td className="py-3 px-4">
                  <TimeTag value={p.entrada} color="var(--green)" dimColor="var(--green-dim)" />
                </td>
                <td className="py-3 px-4">
                  <TimeTag value={p.almoco} color="var(--yellow)" dimColor="var(--yellow-dim)" />
                </td>
                <td className="py-3 px-4">
                  <TimeTag value={p.retorno} color="var(--blue)" dimColor="var(--blue-dim)" />
                </td>
                <td className="py-3 px-4">
                  <TimeTag value={p.saida} color="var(--red)" dimColor="var(--red-dim)" />
                </td>
                <td className="py-3 px-4 td-mono-accent">
                  {horas ?? '—'}
                </td>
                <td className="py-3 px-4">
                  {isToday ? (
                    <span
                      className="inline-block px-2 py-0-5 rounded-full text-18 font-medium tag-hoje"
                    >
                      Hoje
                    </span>
                  ) : (
                    <span
                      className="inline-block px-2 py-0-5 rounded-full text-18 font-medium font-mono"
                      style={{ background: status.label === 'Completo' ? 'var(--green-dim)' : status.label === 'Parcial' ? 'var(--yellow-dim)' : 'var(--red-dim)', color: status.color, border: `1px solid ${status.color}` }}
                    >
                      {status.label}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===== Tag de horário colorida =====
function TimeTag({ value, color, dimColor }: { value: string | null; color: string; dimColor: string }) {
  if (!value) {
    return (
      <span className="timetag-empty">—</span>
    );
  }
  return (
    <span
      className="inline-block px-2 py-0-5 rounded text-20 timetag-filled"
      style={{ background: dimColor, color }}
    >
      {format(new Date(value), 'HH:mm')}
    </span>
  );
}

// end of file
