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
import { usePontoMetricas, useRelatorio, useExportarPonto } from '@/hooks/usePonto';
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
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
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
import type { Ponto } from '@/types';

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
  return format(new Date(dateStr), 'HH:mm');
}

function getStatusLabel(p: Ponto): { label: string; color: string; dimColor: string } {
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
  const exportar = useExportarPonto();

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
              <div className="pa-chart-header">
                <TrendingUp size={16} />
                <CardTitle className="text-sm section-title">FREQUÊNCIA SEMANAL</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loadingMetricas || !metricas ? (
                <div className="pa-chart-skeleton">
                  {[60, 80, 50, 90, 70].map((h, i) => (
                    <div key={i} className="skeleton" style={{ height: `${h}%`, width: '14%' }} />
                  ))}
                </div>
              ) : metricas.frequenciaSemanal.length === 0 ? (
                <div className="pa-chart-empty">
                  <TrendingUp size={32} />
                  <span>Sem dados no período</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={metricas.frequenciaSemanal} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="semana" tick={{ fill: '#8a8a9a', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8a8a9a', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8, color: '#fff', fontSize: 12 }}
                      formatter={(value, name) => [value, name === 'presencas' ? 'Presenças' : 'Total']}
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
                      stroke="#22d3a0"
                      fill="url(#areaGrad)"
                      strokeWidth={2}
                    />
                    <Line type="monotone" dataKey="total" stroke="#6c63ff" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
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
                      {['FUNCIONÁRIO', 'DATA', 'ENTRADA', 'ALMOÇO', 'RETORNO', 'SAÍDA', 'HORAS', 'STATUS', 'ENC.AUTO'].map((h) => (
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
                          <td className="py-3 px-4 font-mono text-secondary text-20">{format(new Date(p.date), 'dd/MM/yyyy')}</td>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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

      </div>
    </>
  );
}

function TimeTag({ value, color, dimColor }: { value: string | null; color: string; dimColor: string }) {
  if (!value) return <span className="timetag-empty text-20">—</span>;
  return (
    <span className="inline-block px-2 py-0-5 rounded text-19 timetag-filled" style={{ background: dimColor, color }}>
      {format(new Date(value), 'HH:mm')}
    </span>
  );
}
