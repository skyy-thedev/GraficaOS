import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import * as Dialog from '@radix-ui/react-dialog';
import { usePontoMetricas, useRelatorio, useExportarPonto, useAnomalias, useInsights, useEditarPonto, useFolgas } from '@/hooks/usePonto';
import { useUsers } from '@/hooks/useUsers';
import {
  Clock,
  Users as UsersIcon,
  CheckCircle,
  AlertCircle,
  Zap,
  Download,
  FileText,
  FileSpreadsheet,
  Mail,
  X,
  BarChart3,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Award,
  Timer,
  Pencil,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { formatarHora, formatarData } from '@/utils/timezone';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import type { Ponto, Anomalia, PontoStatus, MetricasPonto } from '@/types';

function getPercentualSemanal(presencas: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((presencas / total) * 100);
}

function listarDatasNoPeriodo(start: string, end: string): string[] {
  const datas: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const dataFinal = new Date(`${end}T00:00:00`);

  while (cursor <= dataFinal) {
    datas.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return datas;
}

function limitarDataFinalAoHoje(end: string): string {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  return end < hoje ? end : hoje;
}

function getDiaSemana(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00`).getDay();
}

function formatarPercentual(value: number): string {
  return `${Math.round(value)}%`;
}

function FrequenciaSemanalTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: { presencas: number; total: number; percentual: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const base = payload[0]?.payload;
  if (!base) return null;

  return (
    <div style={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 12, color: '#fff', fontSize: 12, padding: '12px 14px', minWidth: 180 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#22d3a0' }}>Presenças registradas</span>
          <strong style={{ color: '#22d3a0' }}>{base.presencas}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#8b7cff' }}>Jornadas esperadas</span>
          <strong style={{ color: '#8b7cff' }}>{base.total}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#cfd3ff' }}>Presença da semana</span>
          <strong>{base.percentual}%</strong>
        </div>
      </div>
    </div>
  );
}

// Helpers
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

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return formatarHora(dateStr);
}

function isoToHHmm(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatarHora(iso);
}

function getStatusLabel(p: Ponto): { label: string; color: string; dimColor: string } {
  if (p.status === 'FOLGA') return { label: 'Folga', color: 'var(--accent)', dimColor: 'rgba(108,99,255,0.15)' };
  if (p.status === 'FALTA') return { label: 'Falta', color: 'var(--red)', dimColor: 'var(--red-dim)' };
  if (p.saida) return { label: 'Completo', color: 'var(--green)', dimColor: 'var(--green-dim)' };
  if (p.retorno) return { label: 'Trabalhando', color: 'var(--blue)', dimColor: 'var(--blue-dim)' };
  if (p.almoco) return { label: 'Almoço', color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' };
  if (p.entrada) return { label: 'Trabalhando', color: 'var(--blue)', dimColor: 'var(--blue-dim)' };
  return { label: 'Ausente', color: 'var(--red)', dimColor: 'var(--red-dim)' };
}

type PeriodoPreset = 'hoje' | 'semana' | 'mes' | 'semestre' | 'ano' | 'custom';

function getDateRange(preset: PeriodoPreset): { start: string; end: string } {
  const hoje = new Date();
  switch (preset) {
    case 'hoje':
      return { start: format(hoje, 'yyyy-MM-dd'), end: format(hoje, 'yyyy-MM-dd') };
    case 'semana':
      return {
        start: format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'mes':
      return {
        start: format(startOfMonth(hoje), 'yyyy-MM-dd'),
        end: format(endOfMonth(hoje), 'yyyy-MM-dd'),
      };
    case 'semestre':
      return {
        start: format(subMonths(hoje, 6), 'yyyy-MM-dd'),
        end: format(hoje, 'yyyy-MM-dd'),
      };
    case 'ano':
      return {
        start: format(new Date(hoje.getFullYear(), 0, 1), 'yyyy-MM-dd'),
        end: format(hoje, 'yyyy-MM-dd'),
      };
    default:
      return { start: format(startOfMonth(hoje), 'yyyy-MM-dd'), end: format(hoje, 'yyyy-MM-dd') };
  }
}

export function PontoAnalyticsPage() {
  const { isAdmin } = useAuth();
  const { data: users } = useUsers();
  const { data: folgasData } = useFolgas();
  const activeUsers = users?.filter((u) => u.active) ?? [];

  const [periodo, setPeriodo] = useState<PeriodoPreset>('mes');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [emailModal, setEmailModal] = useState(false);
  const [emailDest, setEmailDest] = useState('');

  const dateRange = periodo === 'custom' ? { start: customStart, end: customEnd } : getDateRange(periodo);

  const queryParams = {
    startDate: dateRange.start,
    endDate: dateRange.end,
    userId: filterUserId !== 'all' ? filterUserId : undefined,
  };

  const { data: metricas, isLoading: loadingMetricas } = usePontoMetricas(queryParams);
  const { data: pontos, isLoading: loadingPontos } = useRelatorio(queryParams);
  const { data: anomalias } = useAnomalias(queryParams);
  const { data: insightsData } = useInsights({ startDate: dateRange.start, endDate: dateRange.end });
  const exportar = useExportarPonto();
  const [insightsExpanded, setInsightsExpanded] = useState(true);

  // Edição de ponto (admin)
  const [editModal, setEditModal] = useState(false);
  const [editPonto, setEditPonto] = useState<Ponto | null>(null);
  const [editEntrada, setEditEntrada] = useState('');
  const [editAlmoco, setEditAlmoco] = useState('');
  const [editRetorno, setEditRetorno] = useState('');
  const [editSaida, setEditSaida] = useState('');
  const [editStatus, setEditStatus] = useState<PontoStatus>('NORMAL');
  const [editDate, setEditDate] = useState('');
  const editarPontoMutation = useEditarPonto();

  function openEditModal(p: Ponto) {
    setEditPonto(p);
    setEditEntrada(isoToHHmm(p.entrada));
    setEditAlmoco(isoToHHmm(p.almoco));
    setEditRetorno(isoToHHmm(p.retorno));
    setEditSaida(isoToHHmm(p.saida));
    setEditStatus((p.status as PontoStatus) ?? 'NORMAL');
    setEditDate(p.date.substring(0, 10));
    setEditModal(true);
  }

  function handleSaveEdit() {
    if (!editPonto) return;
    editarPontoMutation.mutate(
      {
        id: editPonto.id,
        data: {
          entrada: editEntrada || null,
          almoco: editAlmoco || null,
          retorno: editRetorno || null,
          saida: editSaida || null,
          status: editStatus,
          date: editDate !== editPonto.date.substring(0, 10) ? editDate : undefined,
        },
      },
      { onSuccess: () => setEditModal(false) },
    );
  }

  // Horas por funcionário (agrupado) para gráfico de barras
  const horasPorFunc = useMemo(() => {
    if (!pontos) return [];
    const map = new Map<string, { nome: string; minutos: number }>();
    for (const p of pontos) {
      if (!p.entrada || !p.saida) continue;
      let ms = new Date(p.saida).getTime() - new Date(p.entrada).getTime();
      if (p.almoco && p.retorno) ms -= new Date(p.retorno).getTime() - new Date(p.almoco).getTime();
      const mins = Math.max(0, Math.floor(ms / 60000));
      const existing = map.get(p.userId);
      if (existing) {
        existing.minutos += mins;
      } else {
        map.set(p.userId, { nome: p.user.name.split(' ')[0]!, minutos: mins });
      }
    }
    return Array.from(map.values())
      .map((v) => ({ nome: v.nome, horas: Math.round((v.minutos / 60) * 10) / 10 }))
      .sort((a, b) => b.horas - a.horas);
  }, [pontos]);

  // Resumo de horas trabalhadas e dias por funcionário
  const resumoPorFunc = useMemo(() => {
    if (!pontos || pontos.length === 0) return [];
    const map = new Map<string, { nome: string; initials: string; avatarColor: string; minutos: number; dias: number }>();
    for (const p of pontos) {
      if (p.status === 'FOLGA' || p.status === 'FALTA') continue;
      const existing = map.get(p.userId);
      let mins = 0;
      let worked = 0;
      if (p.entrada && p.saida) {
        let ms = new Date(p.saida).getTime() - new Date(p.entrada).getTime();
        if (p.almoco && p.retorno) ms -= new Date(p.retorno).getTime() - new Date(p.almoco).getTime();
        mins = Math.max(0, Math.floor(ms / 60000));
        worked = 1;
      } else if (p.entrada) {
        worked = 1;
      }
      if (existing) {
        existing.minutos += mins;
        existing.dias += worked;
      } else {
        map.set(p.userId, {
          nome: p.user.name,
          initials: p.user.initials,
          avatarColor: p.user.avatarColor,
          minutos: mins,
          dias: worked,
        });
      }
    }
    return Array.from(map.values())
      .map((v) => {
        const h = Math.floor(v.minutos / 60);
        const m = v.minutos % 60;
        return {
          ...v,
          horasFormatadas: `${h}h${m.toString().padStart(2, '0')}m`,
          mediaMin: v.dias > 0 ? Math.round(v.minutos / v.dias) : 0,
        };
      })
      .sort((a, b) => b.minutos - a.minutos);
  }, [pontos]);

  const frequenciaSemanalData = useMemo(() => {
    if (!metricas) return [];

    return metricas.frequenciaSemanal.map((item) => ({
      ...item,
      percentual: getPercentualSemanal(item.presencas, item.total),
    }));
  }, [metricas]);

  const resumoFrequenciaSemanal = useMemo(() => {
    if (!frequenciaSemanalData.length) return null;

    const melhorSemana = frequenciaSemanalData.reduce((melhor, atual) =>
      atual.percentual > melhor.percentual ? atual : melhor,
    );
    const mediaPercentual = Math.round(
      frequenciaSemanalData.reduce((soma, item) => soma + item.percentual, 0) / frequenciaSemanalData.length,
    );

    return { melhorSemana, mediaPercentual };
  }, [frequenciaSemanalData]);

  const rankingFuncionarios = useMemo(() => {
    const usuariosEscopo = filterUserId === 'all'
      ? activeUsers
      : activeUsers.filter((user) => user.id === filterUserId);

    if (!usuariosEscopo.length) return [];

    const pontosDoPeriodo = pontos ?? [];
    const endDateLimitado = limitarDataFinalAoHoje(dateRange.end);
    const datasPeriodo = dateRange.start <= endDateLimitado ? listarDatasNoPeriodo(dateRange.start, endDateLimitado) : [];
    const pontoMap = new Map(pontosDoPeriodo.map((ponto) => [`${ponto.userId}:${ponto.date.slice(0, 10)}`, ponto]));
    const folgasPorUsuario = new Map<string, Set<number>>();

    for (const user of usuariosEscopo) {
      folgasPorUsuario.set(user.id, new Set((folgasData ?? []).filter((folga) => folga.userId === user.id).map((folga) => folga.diaSemana)));
    }

    return usuariosEscopo
      .map((user) => {
        const folgasUsuario = folgasPorUsuario.get(user.id) ?? new Set<number>();
        let diasEsperados = 0;
        let diasPresente = 0;
        let diasPontuais = 0;
        let faltas = 0;
        let encerramentosAutomaticos = 0;
        let minutosTotais = 0;

        for (const dateKey of datasPeriodo) {
          const diaSemana = getDiaSemana(dateKey);
          const ponto = pontoMap.get(`${user.id}:${dateKey}`);
          const ehDiaUtil = diaSemana !== 0 && diaSemana !== 6;
          const ehFolgaConfigurada = folgasUsuario.has(diaSemana);
          const ehFolgaManual = ponto?.status === 'FOLGA';

          if (!ehDiaUtil || ehFolgaConfigurada || ehFolgaManual) {
            continue;
          }

          diasEsperados++;

          if (ponto?.entrada) {
            diasPresente++;

            const entrada = new Date(ponto.entrada);
            const hora = entrada.getHours();
            const minuto = entrada.getMinutes();
            if (hora < 10 || (hora === 10 && minuto <= 15)) {
              diasPontuais++;
            }

            if (ponto.saida) {
              let totalMs = new Date(ponto.saida).getTime() - new Date(ponto.entrada).getTime();
              if (ponto.almoco && ponto.retorno) {
                totalMs -= new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
              }
              minutosTotais += Math.max(0, Math.floor(totalMs / 60000));
            }
          } else {
            faltas++;
          }

          if (ponto?.encerramentoAutomatico) {
            encerramentosAutomaticos++;
          }
        }

        const percentualPresenca = diasEsperados > 0 ? Math.round((diasPresente / diasEsperados) * 100) : 0;
        const percentualPontualidade = diasPresente > 0 ? Math.round((diasPontuais / diasPresente) * 100) : 0;
        const horasTotais = `${Math.floor(minutosTotais / 60)}h${String(minutosTotais % 60).padStart(2, '0')}m`;
        const score = percentualPresenca * 1000 + percentualPontualidade * 10 - faltas * 5 - encerramentosAutomaticos * 3;

        return {
          id: user.id,
          nome: user.name,
          initials: user.initials,
          avatarColor: user.avatarColor,
          diasEsperados,
          diasPresente,
          faltas,
          percentualPresenca,
          percentualPontualidade,
          encerramentosAutomaticos,
          horasTotais,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || b.percentualPresenca - a.percentualPresenca || b.percentualPontualidade - a.percentualPontualidade || a.faltas - b.faltas)
      .map((item, index) => ({ ...item, posicao: index + 1 }));
  }, [activeUsers, filterUserId, pontos, folgasData, dateRange.start, dateRange.end]);

  const alertasGerenciais = useMemo(() => {
    const alertas: Array<{ id: string; titulo: string; descricao: string; tipo: 'danger' | 'warning' | 'info' }> = [];

    if (metricas && metricas.percentualPresenca < 75) {
      alertas.push({
        id: 'presenca-baixa',
        titulo: 'Presença geral abaixo do ideal',
        descricao: `O período está com ${metricas.percentualPresenca}% de presença. Vale revisar faltas recentes e escala da equipe.`,
        tipo: 'danger',
      });
    }

    if (metricas && metricas.encerramentosAutomaticos >= 3) {
      alertas.push({
        id: 'encerramentos-auto',
        titulo: 'Muitos encerramentos automáticos',
        descricao: `${metricas.encerramentosAutomaticos} ponto(s) foram encerrados automaticamente no período.`,
        tipo: 'warning',
      });
    }

    const faltosos = rankingFuncionarios.filter((funcionario) => funcionario.faltas > 0);
    if (faltosos.length > 0) {
      const top = faltosos[0]!;
      alertas.push({
        id: 'faltas-funcionario',
        titulo: 'Funcionário com faltas registradas',
        descricao: `${top.nome} acumula ${top.faltas} falta(s) no período analisado.`,
        tipo: top.faltas >= 2 ? 'danger' : 'warning',
      });
    }

    const baixaPontualidade = rankingFuncionarios.find((funcionario) => funcionario.diasPresente >= 2 && funcionario.percentualPontualidade < 70);
    if (baixaPontualidade) {
      alertas.push({
        id: 'pontualidade-baixa',
        titulo: 'Pontualidade em atenção',
        descricao: `${baixaPontualidade.nome} está com ${baixaPontualidade.percentualPontualidade}% de pontualidade no período.`,
        tipo: 'warning',
      });
    }

    if ((anomalias?.length ?? 0) > 0) {
      alertas.push({
        id: 'anomalias-detectadas',
        titulo: 'Anomalias detectadas nos registros',
        descricao: `${anomalias!.length} anomalia(s) exigem revisão administrativa.`,
        tipo: 'info',
      });
    }

    return alertas.slice(0, 4);
  }, [metricas, rankingFuncionarios, anomalias]);

  // Guard: redireciona se não for admin (depois de todos os hooks)
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleExportEmail = () => {
    if (!emailDest) return;
    exportar.enviarEmail.mutate({ ...queryParams, destinatario: emailDest });
    setEmailModal(false);
    setEmailDest('');
  };

  const presets: { value: PeriodoPreset; label: string }[] = [
    { value: 'hoje', label: 'Hoje' },
    { value: 'semana', label: 'Esta Semana' },
    { value: 'mes', label: 'Este Mês' },
    { value: 'semestre', label: 'Semestre' },
    { value: 'ano', label: 'Este Ano' },
    { value: 'custom', label: '📅 Personalizado' },
  ];

  return (
    <>
      <Topbar title="Analytics de Ponto" subtitle="Dashboard analítico" />

      <div className="page-wrapper pa-page">

        {/* Filtros rápidos */}
        <div className="pa-filters">
          <div className="pa-filter-presets">
            {presets.map((p) => (
              <button
                key={p.value}
                className={`pa-filter-btn${periodo === p.value ? ' pa-filter-active' : ''}`}
                onClick={() => setPeriodo(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="pa-filter-extras">
            {periodo === 'custom' && (
              <div className="pa-filter-range">
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                <span className="pa-filter-sep">até</span>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            )}

            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger style={{ width: 220 }}>
                <SelectValue placeholder="Todos os funcionários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funcionários</SelectItem>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stat Cards */}
        {loadingMetricas ? (
          <div className="dash-stats-grid">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
          </div>
        ) : metricas ? (
          <div className="dash-stats-grid">
            <div className="dash-stat-card dash-stat-purple">
              <div className="dash-stat-icon-wrap dash-stat-icon-purple"><Clock size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-number">{metricas.totalHorasTrabalhadas}</span>
                <span className="dash-stat-label">Total Horas</span>
              </div>
            </div>
            <div className="dash-stat-card dash-stat-green">
              <div className="dash-stat-icon-wrap dash-stat-icon-green"><UsersIcon size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-number">{metricas.percentualPresenca}%</span>
                <span className="dash-stat-label">Presença</span>
              </div>
            </div>
            <div className="dash-stat-card dash-stat-blue">
              <div className="dash-stat-icon-wrap dash-stat-icon-blue"><CheckCircle size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-number">{metricas.percentualPontualidade}%</span>
                <span className="dash-stat-label">Pontualidade</span>
              </div>
            </div>
            <div className="dash-stat-card dash-stat-red">
              <div className="dash-stat-icon-wrap dash-stat-icon-red"><Zap size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-number">{metricas.encerramentosAutomaticos}</span>
                <span className="dash-stat-label">Enc. Automáticos</span>
              </div>
            </div>
          </div>
        ) : null}

        {alertasGerenciais.length > 0 && (
          <Card>
            <CardHeader>
              <div className="pa-chart-header">
                <AlertCircle size={16} />
                <CardTitle className="text-sm section-title">ALERTAS GERENCIAIS</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {alertasGerenciais.map((alerta) => {
                  const colors = alerta.tipo === 'danger'
                    ? { bg: 'var(--red-dim)', color: 'var(--red)', border: 'var(--red)' }
                    : alerta.tipo === 'warning'
                      ? { bg: 'var(--yellow-dim)', color: 'var(--yellow)', border: 'var(--yellow)' }
                      : { bg: 'var(--blue-dim)', color: 'var(--blue)', border: 'var(--blue)' };

                  return (
                    <div
                      key={alerta.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.color, marginBottom: 6 }}>{alerta.titulo}</div>
                      <div style={{ fontSize: 12, color: 'var(--text1)', lineHeight: 1.45 }}>{alerta.descricao}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {rankingFuncionarios.length > 0 && (
          <Card>
            <CardHeader>
              <div className="pa-chart-header">
                <Award size={16} />
                <CardTitle className="text-sm section-title">RANKING GERENCIAL POR FUNCIONÁRIO</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rankingFuncionarios.map((funcionario) => {
                  const medalha = funcionario.posicao === 1 ? '🥇' : funcionario.posicao === 2 ? '🥈' : funcionario.posicao === 3 ? '🥉' : '•';
                  return (
                    <div
                      key={funcionario.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(220px, 1.6fr) repeat(5, minmax(90px, 1fr))',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{medalha}</span>
                        <div
                          className="bg-dynamic flex h-8 w-8 items-center justify-center rounded-full text-12 font-bold text-white shrink-0"
                          data-color={funcionario.avatarColor}
                        >
                          {funcionario.initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--text1)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {funcionario.posicao}º · {funcionario.nome}
                          </div>
                          <div style={{ color: 'var(--text2)', fontSize: 11 }}>
                            {funcionario.diasPresente}/{funcionario.diasEsperados} jornadas registradas
                          </div>
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text2)', fontSize: 10, marginBottom: 2 }}>Presença</div>
                        <div style={{ color: 'var(--green)', fontWeight: 700 }}>{formatarPercentual(funcionario.percentualPresenca)}</div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text2)', fontSize: 10, marginBottom: 2 }}>Pontualidade</div>
                        <div style={{ color: 'var(--blue)', fontWeight: 700 }}>{formatarPercentual(funcionario.percentualPontualidade)}</div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text2)', fontSize: 10, marginBottom: 2 }}>Faltas</div>
                        <div style={{ color: funcionario.faltas > 0 ? 'var(--red)' : 'var(--text1)', fontWeight: 700 }}>{funcionario.faltas}</div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text2)', fontSize: 10, marginBottom: 2 }}>Enc. auto</div>
                        <div style={{ color: funcionario.encerramentosAutomaticos > 0 ? 'var(--yellow)' : 'var(--text1)', fontWeight: 700 }}>{funcionario.encerramentosAutomaticos}</div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text2)', fontSize: 10, marginBottom: 2 }}>Horas</div>
                        <div style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace' }}>{funcionario.horasTotais}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumo Inteligente */}
        {insightsData && insightsData.destaques.length > 0 && (
          <Card>
            <CardHeader>
              <div className="pa-chart-header" style={{ cursor: 'pointer' }} onClick={() => setInsightsExpanded(!insightsExpanded)}>
                <Lightbulb size={16} style={{ color: 'var(--yellow)' }} />
                <CardTitle className="text-sm section-title">RESUMO INTELIGENTE DO PERÍODO</CardTitle>
                {insightsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </CardHeader>
            {insightsExpanded && (
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Destaques */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                    {insightsData.destaques.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', gap: 10, padding: 12, borderRadius: 8,
                          background: d.tipo === 'POSITIVO' ? 'var(--green-dim)' : d.tipo === 'ATENCAO' ? 'var(--yellow-dim)' : 'var(--bg3)',
                          border: `1px solid ${d.tipo === 'POSITIVO' ? 'var(--green)' : d.tipo === 'ATENCAO' ? 'var(--yellow)' : 'var(--border2)'}`,
                        }}
                      >
                        <span style={{ fontSize: 18 }}>
                          {d.tipo === 'POSITIVO' ? '✅' : d.tipo === 'ATENCAO' ? '⚠️' : 'ℹ️'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)' }}>{d.titulo}</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{d.descricao}</div>
                          {d.metrica && (
                            <span style={{
                              display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 4,
                              fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                              background: d.tipo === 'POSITIVO' ? 'var(--green-dim)' : 'var(--yellow-dim)',
                              color: d.tipo === 'POSITIVO' ? 'var(--green)' : 'var(--yellow)',
                            }}>
                              {d.metrica}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Funcionários destaque */}
                  {insightsData.funcionarioDestaque && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {insightsData.funcionarioDestaque.melhorPresenca && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12 }}>
                          <Award size={14} style={{ color: 'var(--green)' }} />
                          <span style={{ color: 'var(--text2)' }}>Melhor presença:</span>
                          <strong style={{ color: 'var(--text1)' }}>{insightsData.funcionarioDestaque.melhorPresenca.nome}</strong>
                          <span style={{ color: 'var(--green)', fontFamily: 'monospace', fontWeight: 700 }}>{insightsData.funcionarioDestaque.melhorPresenca.percentual}%</span>
                        </div>
                      )}
                      {insightsData.funcionarioDestaque.melhorPontualidade && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12 }}>
                          <Timer size={14} style={{ color: 'var(--blue)' }} />
                          <span style={{ color: 'var(--text2)' }}>Mais pontual:</span>
                          <strong style={{ color: 'var(--text1)' }}>{insightsData.funcionarioDestaque.melhorPontualidade.nome}</strong>
                          <span style={{ color: 'var(--blue)', fontFamily: 'monospace', fontWeight: 700 }}>{insightsData.funcionarioDestaque.melhorPontualidade.percentual}%</span>
                        </div>
                      )}
                      {insightsData.funcionarioDestaque.maisHoras && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12 }}>
                          <Clock size={14} style={{ color: 'var(--accent)' }} />
                          <span style={{ color: 'var(--text2)' }}>Mais horas:</span>
                          <strong style={{ color: 'var(--text1)' }}>{insightsData.funcionarioDestaque.maisHoras.nome}</strong>
                          <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 700 }}>{insightsData.funcionarioDestaque.maisHoras.horas}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recomendações */}
                  {insightsData.recomendacoes.length > 0 && (
                    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, border: '1px solid var(--border2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
                        <Lightbulb size={14} style={{ color: 'var(--yellow)' }} /> Recomendações
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {insightsData.recomendacoes.map((r, i) => (
                          <li key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Anomalias Detectadas */}
        {anomalias && anomalias.length > 0 && (
          <Card>
            <CardHeader>
              <div className="pa-chart-header">
                <ShieldAlert size={16} style={{ color: 'var(--red)' }} />
                <CardTitle className="text-sm section-title">
                  ANOMALIAS DETECTADAS
                  <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red)' }}>
                    {anomalias.length}
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {anomalias.map((a: Anomalia, i: number) => {
                  const sevColor = a.severidade === 'ALTA' ? 'var(--red)' : a.severidade === 'MEDIA' ? 'var(--yellow)' : 'var(--blue)';
                  const sevDim = a.severidade === 'ALTA' ? 'var(--red-dim)' : a.severidade === 'MEDIA' ? 'var(--yellow-dim)' : 'var(--blue-dim)';
                  const sevIcon = a.severidade === 'ALTA' ? '🚨' : a.severidade === 'MEDIA' ? '⚠️' : 'ℹ️';
                  return (
                    <div
                      key={`${a.pontoId}-${a.tipo}-${i}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 6, background: 'var(--bg3)', border: `1px solid var(--border2)`,
                      }}
                    >
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: sevDim, color: sevColor, border: `1px solid ${sevColor}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {sevIcon} {a.severidade}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)' }}>
                          {a.userName} — {a.data}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{a.descricao}</div>
                        {a.sugestao && (
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontStyle: 'italic' }}>
                            💡 {a.sugestao}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráficos */}
        <div className="pa-charts-grid">
          {/* Horas por funcionário */}
          <Card>
            <CardHeader>
              <div className="pa-chart-header">
                <BarChart3 size={16} />
                <CardTitle className="text-sm section-title">HORAS POR FUNCIONÁRIO</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPontos ? (
                <div className="pa-chart-skeleton">
                  {[80, 60, 90, 70, 50].map((h, i) => (
                    <div key={i} className="skeleton" style={{ height: `${h}%`, width: '14%' }} />
                  ))}
                </div>
              ) : horasPorFunc.length === 0 ? (
                <div className="pa-chart-empty">
                  <BarChart3 size={32} />
                  <span>Sem dados no período</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={horasPorFunc} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" tick={{ fill: '#8a8a9a', fontSize: 11 }} />
                    <YAxis dataKey="nome" type="category" width={80} tick={{ fill: '#c0c0d0', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8, color: '#fff', fontSize: 12 }}
                      formatter={(value) => [`${value}h`, 'Horas']}
                    />
                    <Bar dataKey="horas" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={22} />
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6c63ff" />
                        <stop offset="100%" stopColor="#9d97ff" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Frequência */}
          <Card>
            <CardHeader>
              <div className="pa-chart-header" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} />
                  <CardTitle className="text-sm section-title">FREQUÊNCIA SEMANAL</CardTitle>
                </div>
                {resumoFrequenciaSemanal && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto', justifyContent: 'flex-end' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--green-dim)', color: 'var(--green)', fontSize: 11, fontWeight: 700, border: '1px solid var(--green)' }}>
                      Média: {resumoFrequenciaSemanal.mediaPercentual}%
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--accent-dim, rgba(108,99,255,0.15))', color: 'var(--accent)', fontSize: 11, fontWeight: 700, border: '1px solid var(--accent)' }}>
                      Melhor semana: {resumoFrequenciaSemanal.melhorSemana.semana} · {resumoFrequenciaSemanal.melhorSemana.percentual}%
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingMetricas || !metricas ? (
                <div className="pa-chart-skeleton">
                  {[60, 80, 50, 90, 70].map((h, i) => (
                    <div key={i} className="skeleton" style={{ height: `${h}%`, width: '14%' }} />
                  ))}
                </div>
              ) : frequenciaSemanalData.length === 0 ? (
                <div className="pa-chart-empty">
                  <TrendingUp size={32} />
                  <span>Sem dados no período</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: '#22d3a0', display: 'inline-block' }} />
                      Presenças registradas
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: '#8b7cff', display: 'inline-block' }} />
                      Jornadas esperadas
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: '#4db8ff', display: 'inline-block' }} />
                      % de presença
                    </span>
                  </div>

                  <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={frequenciaSemanalData} margin={{ left: -10, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="semana" tick={{ fill: '#8a8a9a', fontSize: 11 }} />
                    <YAxis yAxisId="jornadas" tick={{ fill: '#8a8a9a', fontSize: 11 }} />
                    <YAxis yAxisId="percentual" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#8a8a9a', fontSize: 11 }} />
                    <Tooltip
                      content={<FrequenciaSemanalTooltip />}
                    />
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3a0" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22d3a0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="presencas"
                      yAxisId="jornadas"
                      stroke="#22d3a0"
                      fill="url(#areaGrad)"
                      strokeWidth={2}
                    />
                    <Line type="monotone" dataKey="total" yAxisId="jornadas" stroke="#8b7cff" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Jornadas esperadas" />
                    <Line type="monotone" dataKey="percentual" yAxisId="percentual" stroke="#4db8ff" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: '#4db8ff' }} name="% de presença" />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Exportações + Tabela */}
        <Card>
          <CardHeader>
            <div className="pa-table-header">
              <CardTitle className="text-sm section-title">REGISTROS DETALHADOS</CardTitle>
              <div className="pa-export-btns">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => exportar.exportCSV.mutate(queryParams)}
                  disabled={exportar.exportCSV.isPending}
                >
                  <Download size={14} /> CSV
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => exportar.exportXLSX.mutate(queryParams)}
                  disabled={exportar.exportXLSX.isPending}
                >
                  <FileSpreadsheet size={14} /> Excel
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => exportar.exportPDF.mutate(queryParams)}
                  disabled={exportar.exportPDF.isPending}
                >
                  <FileText size={14} /> PDF
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setEmailModal(true)}
                >
                  <Mail size={14} /> Email
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPontos ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12 w-full" />)}
              </div>
            ) : !pontos || pontos.length === 0 ? (
              <div className="pa-chart-empty" style={{ padding: '48px 0' }}>
                <Clock size={36} />
                <span>Nenhum registro encontrado no período selecionado</span>
              </div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className="w-full text-left table-text">
                  <thead>
                    <tr className="table-header-row">
                      {['FUNCIONÁRIO', 'DATA', 'ENTRADA', 'ALMOÇO', 'RETORNO', 'SAÍDA', 'HORAS', 'STATUS', 'ENC.AUTO', 'AÇÕES'].map((h) => (
                        <th key={h} className="th-cell">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pontos.map((p) => {
                      const horas = calcularHoras(p);
                      const status = getStatusLabel(p);
                      const isEncAuto = p.encerramentoAutomatico;

                      return (
                        <tr key={p.id} className={`table-body-row${isEncAuto ? ' pa-enc-auto-row' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-dynamic flex h-8 w-8 items-center justify-center rounded-full text-10 font-bold text-white shrink-0" data-color={p.user.avatarColor}>
                                {p.user.initials}
                              </div>
                              <span className="text-21 font-medium dash-name">{p.user.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-secondary text-20">{formatarData(p.date)}</td>
                          <td className="py-3 px-4"><TimeTag value={p.entrada} color="var(--green)" dimColor="var(--green-dim)" /></td>
                          <td className="py-3 px-4"><TimeTag value={p.almoco} color="var(--yellow)" dimColor="var(--yellow-dim)" /></td>
                          <td className="py-3 px-4"><TimeTag value={p.retorno} color="var(--blue)" dimColor="var(--blue-dim)" /></td>
                          <td className="py-3 px-4"><TimeTag value={p.saida} color="var(--red)" dimColor="var(--red-dim)" /></td>
                          <td className="py-3 px-4 font-mono text-accent font-semibold text-20">{horas ?? '—'}</td>
                          <td className="py-3 px-4">
                            <span
                              className="inline-block px-2-5 py-1 rounded-full text-18 font-semibold font-mono tracking-wide"
                              style={{ background: status.dimColor, color: status.color, border: `1px solid ${status.color}` }}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isEncAuto ? (
                              <span className="pa-enc-badge" title="Saída registrada automaticamente às 22h">
                                <AlertCircle size={12} /> Auto
                              </span>
                            ) : (
                              <span className="text-20" style={{ color: 'var(--text3)' }}>—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-18 font-medium transition-colors"
                              style={{ background: 'var(--bg3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}
                              onClick={() => openEditModal(p)}
                              title="Editar horários"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo de horas por funcionário */}
        {pontos && pontos.length > 0 && resumoPorFunc.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="pa-card-title">
                <Timer size={18} /> Resumo do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="table-wrapper overflow-x-auto">
                <table className="w-full text-left table-text">
                  <thead>
                    <tr className="table-header-row">
                      {['FUNCIONÁRIO', 'DIAS TRABALHADOS', 'TOTAL DE HORAS', 'MÉDIA DIÁRIA'].map((h) => (
                        <th key={h} className="th-cell">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumoPorFunc.map((r) => {
                      const mediaH = Math.floor(r.mediaMin / 60);
                      const mediaM = r.mediaMin % 60;
                      return (
                        <tr key={r.nome} className="table-body-row">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-dynamic flex h-8 w-8 items-center justify-center rounded-full text-10 font-bold text-white shrink-0" data-color={r.avatarColor}>
                                {r.initials}
                              </div>
                              <span className="text-21 font-medium dash-name">{r.nome}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2-5 py-1 rounded-full text-18 font-semibold font-mono" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--blue)' }}>
                              {r.dias} {r.dias === 1 ? 'dia' : 'dias'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-accent font-semibold text-20">
                            {r.horasFormatadas}
                          </td>
                          <td className="py-3 px-4 font-mono text-20" style={{ color: 'var(--text2)' }}>
                            {mediaH}h{mediaM.toString().padStart(2, '0')}m / dia
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {resumoPorFunc.length > 1 && (
                    <tfoot>
                      <tr className="table-body-row" style={{ borderTop: '2px solid var(--border)' }}>
                        <td className="py-3 px-4 font-semibold" style={{ color: 'var(--text)' }}>
                          TOTAL GERAL
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2-5 py-1 rounded-full text-18 font-semibold font-mono" style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green)' }}>
                            {resumoPorFunc.reduce((sum, r) => sum + r.dias, 0)} dias
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-20" style={{ color: 'var(--accent)' }}>
                          {(() => {
                            const totalMin = resumoPorFunc.reduce((sum, r) => sum + r.minutos, 0);
                            return `${Math.floor(totalMin / 60)}h${(totalMin % 60).toString().padStart(2, '0')}m`;
                          })()}
                        </td>
                        <td className="py-3 px-4 font-mono text-20" style={{ color: 'var(--text2)' }}>
                          {(() => {
                            const totalMin = resumoPorFunc.reduce((sum, r) => sum + r.minutos, 0);
                            const totalDias = resumoPorFunc.reduce((sum, r) => sum + r.dias, 0);
                            const avg = totalDias > 0 ? Math.round(totalMin / totalDias) : 0;
                            return `${Math.floor(avg / 60)}h${(avg % 60).toString().padStart(2, '0')}m / dia`;
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de email */}
        <Dialog.Root open={emailModal} onOpenChange={setEmailModal}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" style={{ maxWidth: 420 }}>
              <div className="dialog-header">
                <Dialog.Title className="dialog-title">
                  <Mail size={18} /> Enviar Relatório por Email
                </Dialog.Title>
                <Dialog.Close className="dialog-close"><X size={18} /></Dialog.Close>
              </div>
              <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label">Email destinatário</label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={emailDest}
                    onChange={(e) => setEmailDest(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>
                  O relatório do período <strong>{dateRange.start}</strong> a <strong>{dateRange.end}</strong> será enviado como PDF anexo.
                </p>
              </div>
              <div className="dialog-footer">
                <Button variant="ghost" onClick={() => setEmailModal(false)}>Cancelar</Button>
                <Button onClick={handleExportEmail} disabled={!emailDest || exportar.enviarEmail.isPending}>
                  {exportar.enviarEmail.isPending ? 'Enviando...' : 'Enviar →'}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Modal de edição de ponto */}
        <Dialog.Root open={editModal} onOpenChange={setEditModal}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" style={{ maxWidth: 440 }}>
              <div className="dialog-header">
                <Dialog.Title className="dialog-title">
                  <Pencil size={18} /> Editar Ponto
                </Dialog.Title>
                <Dialog.Close className="dialog-close"><X size={18} /></Dialog.Close>
              </div>
              <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {editPonto && (
                  <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
                    <strong>{editPonto.user.name}</strong>
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Data</label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select
                      className="input"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as PontoStatus)}
                      style={{ width: '100%', height: 36, borderRadius: 8, padding: '0 8px', fontSize: 13, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="FOLGA">Folga</option>
                      <option value="FALTA">Falta</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Entrada</label>
                    <Input type="time" value={editEntrada} onChange={(e) => setEditEntrada(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Almoço</label>
                    <Input type="time" value={editAlmoco} onChange={(e) => setEditAlmoco(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Retorno</label>
                    <Input type="time" value={editRetorno} onChange={(e) => setEditRetorno(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Saída</label>
                    <Input type="time" value={editSaida} onChange={(e) => setEditSaida(e.target.value)} />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
                  Deixe o campo vazio para limpar o horário.
                </p>
              </div>
              <div className="dialog-footer">
                <Button variant="ghost" onClick={() => setEditModal(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={editarPontoMutation.isPending}>
                  {editarPontoMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

      </div>
    </>
  );
}

function TimeTag({ value, color, dimColor }: { value: string | null; color: string; dimColor: string }) {
  if (!value) return <span className="timetag-empty text-20">—</span>;
  return (
    <span className="inline-block px-2 py-0-5 rounded text-19 timetag-filled" style={{ background: dimColor, color }}>
      {formatarHora(value)}
    </span>
  );
}
