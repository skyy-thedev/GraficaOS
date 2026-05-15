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
import { useRelatorio, useEditarPonto, useCriarPontoManual, useFolgas, useConfigurarFolgas } from '@/hooks/usePonto';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { Download, Clock, ClipboardList, CheckCircle, Users as UsersIcon, UserX, Pencil, X, Plus, CalendarOff, Calendar } from 'lucide-react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { FolgaConfig, Ponto, PontoStatus, User } from '@/types';
import { formatarHora, formatarData } from '@/utils/timezone';
import { LOJA_LABELS } from '@/utils/lojas';

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

function getStatusLabel(p: Ponto): { label: string; color: string; dimColor: string } {
  if (p.status === 'FOLGA') return { label: 'Folga', color: 'var(--accent)', dimColor: 'rgba(108,99,255,0.15)' };
  if (p.status === 'FALTA') return { label: 'Falta', color: 'var(--red)', dimColor: 'var(--red-dim)' };
  if (p.saida) return { label: 'Completo', color: 'var(--green)', dimColor: 'var(--green-dim)' };
  if (p.retorno) return { label: 'Trabalhando', color: 'var(--blue)', dimColor: 'var(--blue-dim)' };
  if (p.almoco) return { label: 'Almoço', color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' };
  if (p.entrada) return { label: 'Trabalhando', color: 'var(--blue)', dimColor: 'var(--blue-dim)' };
  return { label: 'Ausente', color: 'var(--red)', dimColor: 'var(--red-dim)' };
}

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return formatarHora(dateStr);
}

/** Extrai HH:mm de uma string ISO para preencher input time */
function isoToHHmm(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatarHora(iso); // retorna "HH:mm"
}

function getDiaSemanaDateKey(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00`).getDay();
}

function criarLinhaFolga(user: User, dateKey: string): Ponto {
  const isoDate = `${dateKey}T12:00:00.000Z`;

  return {
    id: `folga-${user.id}-${dateKey}`,
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      initials: user.initials,
      avatarColor: user.avatarColor,
      loja: user.loja,
    },
    date: isoDate,
    entrada: null,
    almoco: null,
    retorno: null,
    saida: null,
    status: 'FOLGA',
    encerramentoAutomatico: false,
    horasTrabalhadas: null,
    createdAt: isoDate,
    updatedAt: isoDate,
  };
}

function criarLinhaAusencia(user: User, dateKey: string): Ponto {
  const isoDate = `${dateKey}T12:00:00.000Z`;

  return {
    id: `ausencia-${user.id}-${dateKey}`,
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      initials: user.initials,
      avatarColor: user.avatarColor,
      loja: user.loja,
    },
    date: isoDate,
    entrada: null,
    almoco: null,
    retorno: null,
    saida: null,
    status: 'NORMAL',
    encerramentoAutomatico: false,
    horasTrabalhadas: null,
    createdAt: isoDate,
    updatedAt: isoDate,
  };
}

function isRegistroSintetico(ponto: Ponto): boolean {
  return ponto.id.startsWith('folga-') || ponto.id.startsWith('ausencia-');
}

function isFolgaConfiguradaNoDia(userId: string, dateKey: string, folgas: FolgaConfig[]): boolean {
  const diaSemana = getDiaSemanaDateKey(dateKey);
  return folgas.some((folga) => folga.userId === userId && folga.diaSemana === diaSemana);
}

function exportCSV(pontos: Ponto[]) {
  const header = 'Funcionário,Cargo,Data,Entrada,Almoço,Retorno,Saída,Horas,Status\n';
  const rows = pontos.map((p) => {
    const status = getStatusLabel(p);
    const horas = calcularHoras(p) ?? '—';
    return `"${p.user.name}","Funcionário","${formatarData(p.date)}","${fmtTime(p.entrada)}","${fmtTime(p.almoco)}","${fmtTime(p.retorno)}","${fmtTime(p.saida)}","${horas}","${status.label}"`;
  });
  const csv = header + rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gestao-pontos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GestaoPontosPage() {
  const { data: users } = useUsers();
  const { isAdmin } = useAuth();
  const activeUsers = users?.filter((u) => u.active) ?? [];

  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterUserId, setFilterUserId] = useState<string>('all');

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

  // Ponto manual (admin)
  const [manualModal, setManualModal] = useState(false);
  const [manualUserId, setManualUserId] = useState('');
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualEntrada, setManualEntrada] = useState('');
  const [manualAlmoco, setManualAlmoco] = useState('');
  const [manualRetorno, setManualRetorno] = useState('');
  const [manualSaida, setManualSaida] = useState('');
  const [manualStatus, setManualStatus] = useState<PontoStatus>('NORMAL');
  const criarManualMutation = useCriarPontoManual();

  // Folgas config (admin)
  const [folgasModal, setFolgasModal] = useState(false);
  const [folgaUserId, setFolgaUserId] = useState('');
  const [folgaDias, setFolgaDias] = useState<number[]>([]);
  const { data: folgasData } = useFolgas();
  const configurarFolgasMutation = useConfigurarFolgas();

  const diasSemanaLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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

  function openManualModal() {
    setManualUserId('');
    setManualDate(format(new Date(), 'yyyy-MM-dd'));
    setManualEntrada('');
    setManualAlmoco('');
    setManualRetorno('');
    setManualSaida('');
    setManualStatus('NORMAL');
    setManualModal(true);
  }

  function handleCreateManual() {
    if (!manualUserId || !manualDate) return;
    criarManualMutation.mutate(
      {
        userId: manualUserId,
        date: manualDate,
        entrada: manualEntrada || null,
        almoco: manualAlmoco || null,
        retorno: manualRetorno || null,
        saida: manualSaida || null,
        status: manualStatus,
      },
      { onSuccess: () => setManualModal(false) },
    );
  }

  function openFolgasModal() {
    setFolgaUserId('');
    setFolgaDias([]);
    setFolgasModal(true);
  }

  function handleFolgaUserChange(uid: string) {
    setFolgaUserId(uid);
    const userFolgas = folgasData?.filter((f) => f.userId === uid) ?? [];
    setFolgaDias(userFolgas.map((f) => f.diaSemana));
  }

  function toggleFolgaDia(dia: number) {
    setFolgaDias((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]);
  }

  function handleSaveFolgas() {
    if (!folgaUserId) return;
    configurarFolgasMutation.mutate(
      { userId: folgaUserId, diasSemana: folgaDias },
      { onSuccess: () => setFolgasModal(false) },
    );
  }

  const { data: relatorioPontos, isLoading } = useRelatorio({
    startDate: filterDate,
    endDate: filterDate,
    userId: filterUserId !== 'all' ? filterUserId : undefined,
  });

  const usuariosEscopo = useMemo(
    () => (filterUserId === 'all' ? activeUsers : activeUsers.filter((user) => user.id === filterUserId)),
    [activeUsers, filterUserId],
  );

  const pontosExibidos = useMemo(() => {
    const pontosBase = relatorioPontos ?? [];
    const pontoPorUsuario = new Map(pontosBase.map((ponto) => [ponto.userId, ponto]));
    const folgas = folgasData ?? [];
    const diaSemana = getDiaSemanaDateKey(filterDate);
    const ehDiaUtil = diaSemana !== 0 && diaSemana !== 6;

    return usuariosEscopo
      .map((user) => {
        const pontoReal = pontoPorUsuario.get(user.id);

        if (pontoReal) {
          return pontoReal;
        }

        if (isFolgaConfiguradaNoDia(user.id, filterDate, folgas)) {
          return criarLinhaFolga(user, filterDate);
        }

        if (!ehDiaUtil) {
          return null;
        }

        return criarLinhaAusencia(user, filterDate);
      })
      .filter((ponto): ponto is Ponto => Boolean(ponto))
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [relatorioPontos, folgasData, usuariosEscopo, filterDate]);

  const ausentesCount = useMemo(() => {
    return pontosExibidos.filter((ponto) => !ponto.entrada && ponto.status !== 'FOLGA').length;
  }, [pontosExibidos]);

  // Stats
  const totalRegistros = usuariosEscopo.length;
  const completosCount = pontosExibidos.filter((p) => !!p.saida).length;
  const trabalhandoCount = pontosExibidos.filter((p) => p.entrada && !p.saida).length;

  return (
    <>
      <Topbar title="Gestão de Pontos" />

      <div className="page-wrapper gestao-pontos-page p-7 flex flex-col gap-6">
        {/* Stat cards */}
        
        <div className="dash-stats-grid gestao-pontos-stats-grid">
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><ClipboardList size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{totalRegistros}</span>
              <span className="dash-stat-label">Registros</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><CheckCircle size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{completosCount}</span>
              <span className="dash-stat-label">Completos</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><UsersIcon size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{trabalhandoCount}</span>
              <span className="dash-stat-label">Trabalhando</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-red">
            <div className="dash-stat-icon-wrap dash-stat-icon-red"><UserX size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{ausentesCount > 0 ? ausentesCount : 0}</span>
              <span className="dash-stat-label">Ausentes</span>
            </div>
          </div>
        </div>

        {/* Filtros + Exportar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle
                className="text-sm section-title"
              >
                RELATÓRIO DE PONTOS
              </CardTitle>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="sm" onClick={openManualModal}>
                      <Plus size={14} /> Ponto Manual
                    </Button>
                    <Button variant="ghost" size="sm" onClick={openFolgasModal}>
                      <CalendarOff size={14} /> Folgas
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => pontosExibidos.length > 0 && exportCSV(pontosExibidos)}
                  disabled={pontosExibidos.length === 0}
                >
                  <Download size={14} />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ width: '100%', maxWidth: 180 }}
              />
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger className="mobile-select" style={{ width: '100%', maxWidth: 220 }}>
                  <SelectValue placeholder="Todos os funcionários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funcionários</SelectItem>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cards por funcionário */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-32 w-full" />
                ))}
              </div>
            ) : pontosExibidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
                <Clock size={36} className="mb-2 opacity-30" />
                <p className="text-sm">Nenhum registro encontrado para este filtro.</p>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}>
                {pontosExibidos.map((p) => {
                  const horas = calcularHoras(p);
                  const status = getStatusLabel(p);
                  const registroSintetico = isRegistroSintetico(p);

                  return (
                    <div
                      key={p.id}
                      style={{
                        border: '1px solid var(--border2)',
                        borderRadius: 20,
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)',
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="bg-dynamic flex h-10 w-10 items-center justify-center rounded-full text-10 font-bold text-white shrink-0"
                            data-color={p.user.avatarColor}
                          >
                            {p.user.initials}
                          </div>
                          <div className="min-w-0">
                            <span className="block text-21 font-medium dash-name truncate">{p.user.name}</span>
                            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 4 }}>
                              <span className="inline-flex items-center rounded-full px-2 py-1 text-18" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
                                {LOJA_LABELS[p.user.loja]}
                              </span>
                              <span className="text-18" style={{ color: 'var(--text3)' }}>{formatarData(p.date)}</span>
                            </div>
                          </div>
                        </div>
                        <span
                          className="inline-block px-2-5 py-1 rounded-full text-18 font-semibold font-mono tracking-wide"
                          style={{
                            background: status.dimColor,
                            color: status.color,
                            border: `1px solid ${status.color}`,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))' }}>
                        <MetricTime label="Entrada" value={p.entrada} color="var(--green)" dimColor="var(--green-dim)" />
                        <MetricTime label="Almoço" value={p.almoco} color="var(--yellow)" dimColor="var(--yellow-dim)" />
                        <MetricTime label="Retorno" value={p.retorno} color="var(--blue)" dimColor="var(--blue-dim)" />
                        <MetricTime label="Saída" value={p.saida} color="var(--red)" dimColor="var(--red-dim)" />
                      </div>

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Horas do dia</div>
                          <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{horas ?? '—'}</div>
                        </div>
                        {p.encerramentoAutomatico && (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-18" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}>
                            Encerrado automaticamente
                          </span>
                        )}
                        {isAdmin && !registroSintetico && (
                          <button
                            className="inline-flex items-center gap-1 px-3 py-2 rounded text-18 font-medium transition-colors"
                            style={{ background: 'var(--bg3)', color: 'var(--accent)', border: '1px solid var(--border2)' }}
                            onClick={() => openEditModal(p)}
                            title="Editar horários"
                          >
                            <Pencil size={13} /> Editar
                          </button>
                        )}
                        {isAdmin && registroSintetico && (
                          <span className="text-18" style={{ color: 'var(--text3)' }}>
                            Ajuste via ponto manual
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de edição de ponto */}
        <Dialog.Root open={editModal} onOpenChange={setEditModal}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" style={{ maxWidth: 480 }}>
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
                <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Data</label>
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <Select value={editStatus} onValueChange={(v) => setEditStatus(v as PontoStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="FOLGA">Folga</SelectItem>
                        <SelectItem value="FALTA">Falta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editStatus === 'NORMAL' && (
                  <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                )}
                {editStatus !== 'NORMAL' && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, fontStyle: 'italic' }}>
                    {editStatus === 'FOLGA' ? '🗓️ Dia será marcado como folga. Horários serão removidos.' : '⚠️ Dia será marcado como falta. Horários serão removidos.'}
                  </p>
                )}
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

        {/* Modal de ponto manual */}
        <Dialog.Root open={manualModal} onOpenChange={setManualModal}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" style={{ maxWidth: 480 }}>
              <div className="dialog-header">
                <Dialog.Title className="dialog-title">
                  <Plus size={18} /> Ponto Manual
                </Dialog.Title>
                <Dialog.Close className="dialog-close"><X size={18} /></Dialog.Close>
              </div>
              <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Funcionário</label>
                    <Select value={manualUserId} onValueChange={setManualUserId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {activeUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="form-label">Data</label>
                    <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <Select value={manualStatus} onValueChange={(v) => setManualStatus(v as PontoStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="FOLGA">Folga</SelectItem>
                        <SelectItem value="FALTA">Falta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {manualStatus === 'NORMAL' && (
                  <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Entrada</label>
                      <Input type="time" value={manualEntrada} onChange={(e) => setManualEntrada(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Almoço</label>
                      <Input type="time" value={manualAlmoco} onChange={(e) => setManualAlmoco(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Retorno</label>
                      <Input type="time" value={manualRetorno} onChange={(e) => setManualRetorno(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Saída</label>
                      <Input type="time" value={manualSaida} onChange={(e) => setManualSaida(e.target.value)} />
                    </div>
                  </div>
                )}
                {manualStatus !== 'NORMAL' && (
                  <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, fontStyle: 'italic' }}>
                    {manualStatus === 'FOLGA' ? '🗓️ Registro será criado como folga.' : '⚠️ Registro será criado como falta.'}
                  </p>
                )}
              </div>
              <div className="dialog-footer">
                <Button variant="ghost" onClick={() => setManualModal(false)}>Cancelar</Button>
                <Button onClick={handleCreateManual} disabled={!manualUserId || !manualDate || criarManualMutation.isPending}>
                  {criarManualMutation.isPending ? 'Criando...' : 'Criar Ponto'}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Modal de configuração de folgas */}
        <Dialog.Root open={folgasModal} onOpenChange={setFolgasModal}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="dialog-content" style={{ maxWidth: 440 }}>
              <div className="dialog-header">
                <Dialog.Title className="dialog-title">
                  <CalendarOff size={18} /> Configurar Folgas
                </Dialog.Title>
                <Dialog.Close className="dialog-close"><X size={18} /></Dialog.Close>
              </div>
              <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label">Funcionário</label>
                  <Select value={folgaUserId} onValueChange={handleFolgaUserChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {activeUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {folgaUserId && (
                  <div>
                    <label className="form-label">Dias de folga fixa</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {diasSemanaLabels.map((label, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleFolgaDia(idx)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            border: `1.5px solid ${folgaDias.includes(idx) ? 'var(--accent)' : 'var(--border2)'}`,
                            background: folgaDias.includes(idx) ? 'rgba(108,99,255,0.2)' : 'var(--bg3)',
                            color: folgaDias.includes(idx) ? 'var(--accent)' : 'var(--text2)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
                  Selecione os dias da semana em que o funcionário tem folga fixa.
                </p>
              </div>
              <div className="dialog-footer">
                <Button variant="ghost" onClick={() => setFolgasModal(false)}>Cancelar</Button>
                <Button onClick={handleSaveFolgas} disabled={!folgaUserId || configurarFolgasMutation.isPending}>
                  {configurarFolgasMutation.isPending ? 'Salvando...' : 'Salvar Folgas'}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </>
  );
}

// Tag de horário reutilizável
function TimeTag({ value, color, dimColor }: { value: string | null; color: string; dimColor: string }) {
  if (!value) {
    return <span className="timetag-empty text-20">—</span>;
  }
  return (
    <span
      className="inline-block px-2 py-0-5 rounded text-19 timetag-filled"
      style={{ background: dimColor, color }}
    >
      {formatarHora(value)}
    </span>
  );
}

function MetricTime({
  label,
  value,
  color,
  dimColor,
}: {
  label: string;
  value: string | null;
  color: string;
  dimColor: string;
}) {
  return (
    <div style={{ border: '1px solid var(--border2)', borderRadius: 14, padding: 12, background: 'var(--bg2)' }}>
      <div style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <TimeTag value={value} color={color} dimColor={dimColor} />
    </div>
  );
}
