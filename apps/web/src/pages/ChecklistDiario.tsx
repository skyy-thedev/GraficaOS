import { useState, useEffect } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Check,
  Plus,
  BarChart3,
  Pencil,
  Trash2,
  Clock,
  Download,
  AlertTriangle,
  X,
  Power,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/stores/toastStore';
import {
  useChecklistHoje,
  useMarcarItem,
  useChecklistItens,
  useCriarChecklistItem,
  useEditarChecklistItem,
  useToggleChecklistItem,
  useDeletarChecklistItem,
  useRelatorioChecklist,
} from '@/hooks/useChecklist';
import type { ItemHoje, ChecklistItemConfig, RelatorioDia } from '@/types';

// ===== Helpers =====

function formatHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getCardState(item: ItemHoje): 'done-on-time' | 'done-late' | 'late' | 'pending' {
  if (item.feito) {
    if (item.horarioLimite && item.feitoEm) {
      const [h, m] = item.horarioLimite.split(':').map(Number);
      const feitoDate = new Date(item.feitoEm);
      const limite = new Date(feitoDate);
      limite.setHours(h ?? 0, m ?? 0, 0, 0);
      return feitoDate <= limite ? 'done-on-time' : 'done-late';
    }
    return 'done-on-time';
  }
  return item.atrasado ? 'late' : 'pending';
}

function getProgressColor(pct: number): string {
  if (pct >= 100) return 'linear-gradient(90deg, var(--green), #1ab87e)';
  if (pct >= 50) return 'linear-gradient(90deg, var(--accent), #9b8fff)';
  return 'linear-gradient(90deg, var(--yellow), #e0a800)';
}

function todayFormatted(): string {
  const d = new Date();
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return `${dias[date.getDay()]} ${d}/${m}`;
}

function dateInputDefault(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ===== Main Page =====

export function ChecklistPage() {
  const { isAdmin } = useAuth();
  const addToast = useToastStore.getState().addToast;
  const { data: itensHoje, isLoading } = useChecklistHoje();
  const marcar = useMarcarItem();

  const [clock, setClock] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<ChecklistItemConfig | null>(null);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Relógio
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Stats
  const total = itensHoje?.length ?? 0;
  const feitos = itensHoje?.filter((i) => i.feito).length ?? 0;
  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;

  const handleMarcar = (itemId: string, titulo: string, feitoAtual: boolean) => {
    marcar.mutate(itemId, {
      onSuccess: () => {
        addToast({
          icon: feitoAtual ? '○' : '✅',
          title: feitoAtual ? 'Desmarcado' : 'Concluído!',
          message: titulo,
        });
      },
    });
  };

  return (
    <>
      <Topbar title="Checklist Diário" />

      <div className="page-wrapper p-7 flex flex-col gap-5">
        {/* Header: data + relógio */}
        <div className="cl-header">
          <span className="cl-date">{todayFormatted()}</span>
          <span className="cl-clock">{clock}</span>
        </div>

        {/* Barra de progresso */}
        <div className="cl-progress-section">
          <span className="cl-progress-text">
            {feitos} de {total} concluídos · {pct}%
          </span>
          <div className="cl-progress-track">
            <div
              className="cl-progress-fill"
              style={{
                width: `${pct}%`,
                background: getProgressColor(pct),
              }}
            />
          </div>
        </div>

        {/* Ações */}
        <div className="cl-actions">
          {isAdmin && (
            <Button
              onClick={() => { setEditItem(null); setShowItemModal(true); }}
              className="cl-btn-new"
            >
              <Plus size={16} />
              Novo Item
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={() => setShowRelatorio(true)}
              variant="outline"
              className="cl-btn-relatorio"
            >
              <BarChart3 size={16} />
              Relatório
            </Button>
          )}
        </div>

        {/* Lista de itens do dia */}
        {isLoading ? (
          <div className="cl-loading">Carregando checklist...</div>
        ) : total === 0 ? (
          <div className="cl-empty">
            <Check size={40} />
            <p>Nenhum item no checklist</p>
            {isAdmin && <p className="cl-empty-sub">Adicione itens de rotina para começar.</p>}
          </div>
        ) : (
          <div className="cl-list">
            {itensHoje?.map((item) => {
              const state = getCardState(item);
              return (
                <div key={item.id} className={`cl-card cl-card-${state}`}>
                  <button
                    className={`cl-checkbox cl-checkbox-${state}`}
                    onClick={() => handleMarcar(item.id, item.titulo, item.feito)}
                    disabled={marcar.isPending}
                  >
                    {item.feito && <Check size={14} strokeWidth={3} />}
                  </button>

                  <div className="cl-card-content">
                    <div className="cl-card-row1">
                      <span className={`cl-card-titulo ${item.feito ? 'cl-card-titulo-done' : ''}`}>
                        {item.titulo}
                      </span>
                      <div className="cl-card-tags">
                        {state === 'late' && (
                          <span className="cl-tag-atrasado">
                            <AlertTriangle size={10} />
                            ATRASADO
                          </span>
                        )}
                        {state === 'done-late' && (
                          <span className="cl-tag-fora-prazo">FORA DO PRAZO</span>
                        )}
                        {item.horarioLimite && (
                          <span className={`cl-tag-horario cl-tag-horario-${state}`}>
                            <Clock size={10} />
                            até {item.horarioLimite}
                          </span>
                        )}
                      </div>
                    </div>
                    {(item.descricao || item.feitoPor) && (
                      <div className="cl-card-row2">
                        {item.descricao && (
                          <span className="cl-card-desc">{item.descricao}</span>
                        )}
                        {item.feitoPor && (
                          <div className="cl-card-quem">
                            <div
                              className="bg-dynamic cl-avatar"
                              data-color={item.feitoPor.avatarColor}
                            >
                              {item.feitoPor.initials}
                            </div>
                            <span>{item.feitoPor.name.split(' ')[0]}</span>
                            <span className="cl-card-hora">· {formatHora(item.feitoEm)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Painel admin */}
        {isAdmin && <AdminPanel onEdit={(item) => { setEditItem(item); setShowItemModal(true); }} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} />}
      </div>

      {/* Modal Criar/Editar Item */}
      {showItemModal && (
        <ItemFormModal
          editItem={editItem}
          onClose={() => setShowItemModal(false)}
        />
      )}

      {/* Modal Relatório */}
      {showRelatorio && (
        <RelatorioModal onClose={() => setShowRelatorio(false)} />
      )}
    </>
  );
}

// ===== Admin Panel =====

function AdminPanel({
  onEdit,
  deleteConfirm,
  setDeleteConfirm,
}: {
  onEdit: (item: ChecklistItemConfig) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
}) {
  const { data: itens } = useChecklistItens();
  const toggleItem = useToggleChecklistItem();
  const deletarItem = useDeletarChecklistItem();

  return (
    <Card className="cl-admin-card">
      <div className="cl-admin-header">
        <h3 className="cl-admin-title">GERENCIAR ITENS</h3>
      </div>
      <CardContent className="cl-admin-body">
        {!itens || itens.length === 0 ? (
          <p className="cl-admin-empty">Nenhum item cadastrado.</p>
        ) : (
          <div className="cl-admin-list">
            {itens.map((item) => (
              <div key={item.id} className={`cl-admin-item ${!item.ativo ? 'cl-admin-item-inactive' : ''}`}>
                <div className="cl-admin-item-info">
                  <span className="cl-admin-item-titulo">{item.titulo}</span>
                  <span className="cl-admin-item-meta">
                    {item.horarioLimite ?? '—'}
                    <span className="cl-admin-item-sep">·</span>
                    ordem: {item.ordem}
                    {!item.ativo && <span className="cl-tag-inativo">Inativo</span>}
                  </span>
                </div>
                <div className="cl-admin-item-actions">
                  <button
                    onClick={() => toggleItem.mutate(item.id)}
                    className="cl-admin-btn"
                    title={item.ativo ? 'Desativar' : 'Ativar'}
                  >
                    <Power size={14} />
                  </button>
                  <button onClick={() => onEdit(item)} className="cl-admin-btn" title="Editar">
                    <Pencil size={14} />
                  </button>
                  {deleteConfirm === item.id ? (
                    <div className="cl-admin-confirm-delete">
                      <button
                        onClick={() => { deletarItem.mutate(item.id); setDeleteConfirm(null); }}
                        className="cl-admin-btn cl-admin-btn-danger"
                      >
                        Confirmar
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="cl-admin-btn">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(item.id)}
                      className="cl-admin-btn cl-admin-btn-danger"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== Item Form Modal =====

function ItemFormModal({
  editItem,
  onClose,
}: {
  editItem: ChecklistItemConfig | null;
  onClose: () => void;
}) {
  const criarItem = useCriarChecklistItem();
  const editarItem = useEditarChecklistItem();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [horarioLimite, setHorarioLimite] = useState('');
  const [ordem, setOrdem] = useState(0);

  useEffect(() => {
    if (editItem) {
      setTitulo(editItem.titulo);
      setDescricao(editItem.descricao ?? '');
      setHorarioLimite(editItem.horarioLimite ?? '');
      setOrdem(editItem.ordem);
    } else {
      setTitulo('');
      setDescricao('');
      setHorarioLimite('');
      setOrdem(0);
    }
  }, [editItem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      titulo,
      descricao: descricao || undefined,
      horarioLimite: horarioLimite || undefined,
      ordem,
    };

    if (editItem) {
      editarItem.mutate({ id: editItem.id, data }, { onSuccess: onClose });
    } else {
      criarItem.mutate(data, { onSuccess: onClose });
    }
  };

  const isPending = criarItem.isPending || editarItem.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? 'Editar Item' : 'Novo Item de Checklist'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Abrir a loja"
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre a tarefa..."
              rows={2}
              maxLength={300}
            />
          </div>
          <div className="cl-form-row">
            <div className="flex flex-col gap-2 flex-1">
              <Label>Horário Limite</Label>
              <Input
                type="time"
                value={horarioLimite}
                onChange={(e) => setHorarioLimite(e.target.value)}
              />
              <span className="cl-form-hint">
                Itens da manhã devem ser feitos até este horário
              </span>
            </div>
            <div className="flex flex-col gap-2" style={{ width: 100 }}>
              <Label>Ordem</Label>
              <Input
                type="number"
                min={0}
                value={ordem}
                onChange={(e) => setOrdem(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !titulo.trim()}>
              {isPending ? 'Salvando...' : 'Salvar →'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== Relatório Modal =====

function RelatorioModal({ onClose }: { onClose: () => void }) {
  const [startDate, setStartDate] = useState(dateInputDefault(7));
  const [endDate, setEndDate] = useState(dateInputDefault(0));
  const [searchEnabled, setSearchEnabled] = useState(true);

  const { data: relatorio, isLoading } = useRelatorioChecklist(startDate, endDate, searchEnabled);

  const media =
    relatorio && relatorio.length > 0
      ? Math.round(relatorio.reduce((acc, d) => acc + d.percentual, 0) / relatorio.length)
      : 0;

  const handleBuscar = () => {
    setSearchEnabled(false);
    setTimeout(() => setSearchEnabled(true), 50);
  };

  const exportCSV = () => {
    if (!relatorio) return;

    // Header
    const headers = ['Data', 'Total Itens', 'Concluídos', 'Percentual'];
    // Add item columns from first day
    if (relatorio.length > 0 && relatorio[0]) {
      relatorio[0].itens.forEach((i) => headers.push(i.titulo));
    }

    const rows = relatorio.map((dia) => {
      const base = [dia.data, dia.totalItens, dia.itensConcluidos, `${dia.percentual}%`];
      dia.itens.forEach((i) => base.push(i.feito ? 'S' : 'N'));
      return base.join(';');
    });

    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checklist-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="cl-relatorio-modal">
        <DialogHeader>
          <DialogTitle>
            <BarChart3 size={18} />
            Relatório de Cumprimento
          </DialogTitle>
        </DialogHeader>

        <div className="cl-relatorio-filters">
          <div className="cl-relatorio-dates">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="cl-relatorio-sep">até</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={handleBuscar} variant="outline" className="cl-btn-buscar">
            Buscar
          </Button>
        </div>

        <div className="cl-relatorio-body">
          {isLoading ? (
            <div className="cl-loading">Carregando relatório...</div>
          ) : !relatorio || relatorio.length === 0 ? (
            <div className="cl-empty">
              <BarChart3 size={32} />
              <p>Nenhum dado no período</p>
            </div>
          ) : (
            <>
              <div className="cl-relatorio-list">
                {relatorio.map((dia) => (
                  <RelatorioRow key={dia.data} dia={dia} />
                ))}
              </div>
              <div className="cl-relatorio-footer">
                <span className="cl-relatorio-media">
                  Média do período: <strong>{media}%</strong>
                </span>
                <Button onClick={exportCSV} variant="outline" className="cl-btn-csv">
                  <Download size={14} />
                  Exportar CSV
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RelatorioRow({ dia }: { dia: RelatorioDia }) {
  const [open, setOpen] = useState(false);
  const pctColor = dia.percentual >= 80 ? 'var(--green)' : dia.percentual >= 50 ? 'var(--accent)' : 'var(--yellow)';
  const emoji = dia.percentual >= 100 ? ' ✅' : dia.percentual < 50 ? ' ⚠️' : '';

  return (
    <div className="cl-relatorio-row-wrap">
      <button className="cl-relatorio-row" onClick={() => setOpen(!open)}>
        <span className="cl-relatorio-day">{formatDateBR(dia.data)}</span>
        <div className="cl-relatorio-bar-wrap">
          <div className="cl-relatorio-bar-track">
            <div
              className="cl-relatorio-bar-fill"
              style={{ width: `${dia.percentual}%`, background: pctColor }}
            />
          </div>
        </div>
        <span className="cl-relatorio-pct" style={{ color: pctColor }}>{dia.percentual}%</span>
        <span className="cl-relatorio-count">
          {dia.itensConcluidos}/{dia.totalItens} itens{emoji}
        </span>
      </button>
      {open && (
        <div className="cl-relatorio-detail">
          {dia.itens.map((item, idx) => (
            <div key={idx} className={`cl-relatorio-detail-item ${item.feito ? 'cl-detail-done' : 'cl-detail-pending'}`}>
              <span className="cl-detail-check">{item.feito ? '✅' : '○'}</span>
              <span className="cl-detail-titulo">{item.titulo}</span>
              {item.horarioLimite && (
                <span className="cl-detail-hora">até {item.horarioLimite}</span>
              )}
              {item.feitoPor && (
                <span className="cl-detail-quem">{item.feitoPor}</span>
              )}
              {item.feito && item.noHorario && (
                <span className="cl-detail-badge-ok">No prazo</span>
              )}
              {item.feito && !item.noHorario && item.horarioLimite && (
                <span className="cl-detail-badge-late">Fora do prazo</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
