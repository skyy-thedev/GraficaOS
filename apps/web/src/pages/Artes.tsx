import { useState, useMemo, useEffect } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useArtes,
  useCreateArte,
  useUpdateArte,
  useUpdateArteStatus,
  useDeleteArte,
  useUploadArquivos,
  useDeleteArquivo,
} from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import type { Arte, ArteStatus, CreateArteRequest, ProdutoTipo, Urgencia } from '@/types';
import {
  Palette,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Trash2,
  Edit2,
  Upload,
  FileText,
  ImageIcon,
  X,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';
import { API_BASE } from '@/services/api';

// ===== Configurações =====
const STATUS_CONFIG: Record<ArteStatus, { label: string; color: string }> = {
  TODO: { label: 'A Fazer', color: '#9ca3af' },
  DOING: { label: 'Fazendo', color: '#4db8ff' },
  REVIEW: { label: 'Revisão', color: '#f5c542' },
  DONE: { label: 'Concluído', color: '#22d3a0' },
};

const URGENCIA_CONFIG: Record<Urgencia, { label: string; variant: 'info' | 'default' | 'danger' }> = {
  LOW: { label: 'Baixa', variant: 'info' },
  NORMAL: { label: 'Normal', variant: 'default' },
  HIGH: { label: 'Urgente', variant: 'danger' },
};

const PRODUTO_OPTIONS: { value: ProdutoTipo; label: string }[] = [
  { value: 'AZULEJO', label: 'Azulejo' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'ADESIVO', label: 'Adesivo' },
  { value: 'PLACA', label: 'Placa' },
  { value: 'FAIXA', label: 'Faixa' },
  { value: 'OUTRO', label: 'Outro' },
];

const STATUSES: ArteStatus[] = ['TODO', 'DOING', 'REVIEW', 'DONE'];

// ===== Componente de Card arrastável =====
function SortableArteCard({
  arte,
  onView,
}: {
  arte: Arte;
  onView: (arte: Arte) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: arte.id, data: { arte } });

  const dragStyle = transform || transition ? {
    transform: CSS.Transform.toString(transform),
    transition,
  } : undefined;

  // Track if we're dragging to prevent card click
  const handleCardClick = () => {
    if (!isDragging) {
      onView(arte);
    }
  };

  const isOverdue = arte.prazo && new Date(arte.prazo) < new Date() && arte.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'opacity-50' : 'opacity-100'}
      {...(dragStyle ? { style: dragStyle } : {})}
    >
      <Card
        className="cursor-pointer kanban-card-hover transition-colors group relative overflow-hidden"
        onClick={handleCardClick}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 rounded-sm"
          style={{ width: 3, background: STATUS_CONFIG[arte.status].color }}
        />
        <CardContent className="kanban-card-content p-4 pl-5 space-y-2">
          {/* Row 1: Drag handle + Code + Urgency badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                title="Arrastar arte"
                aria-label="Arrastar arte"
                className="cursor-grab active-cursor-grabbing kanban-drag-handle"
                onClick={(e) => e.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                <GripVertical size={18} />
              </button>
              <span className="font-bold kanban-codigo">
                {arte.codigo}
              </span>
            </div>
            <Badge variant={URGENCIA_CONFIG[arte.urgencia].variant}>
              {arte.urgencia === 'HIGH' && <AlertTriangle size={12} className="mr-1" />}
              {URGENCIA_CONFIG[arte.urgencia].label}
            </Badge>
          </div>

          {/* Row 2: Client name */}
          <h4 className="font-semibold line-clamp-2 kanban-title">
            {arte.clienteNome}
          </h4>

          {/* Row 3: Product + dimensions */}
          <div className="flex items-center gap-2 kanban-meta">
            <Palette size={14} className="shrink-0" />
            <span>{PRODUTO_OPTIONS.find(p => p.value === arte.produto)?.label ?? arte.produto}</span>
            <span className="kanban-dot-sep">·</span>
            <span className="kanban-meta-mono">
              {arte.largura}×{arte.altura}m
            </span>
          </div>

          {/* Row 4: Prazo + ATRASADO badge */}
          {arte.prazo && (
            <div className="flex items-center gap-2 kanban-prazo">
              <Clock size={14} className="shrink-0" />
              <span>{format(new Date(arte.prazo), 'dd/MM')}</span>
              {isOverdue && (
                <span className="inline-block px-1-5 py-0-5 rounded-full kanban-atrasado">
                  ATRASADO
                </span>
              )}
            </div>
          )}

          {/* Row 5: Responsável + files + urgency dot */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="bg-dynamic flex h-6 w-6 items-center justify-center rounded-full text-10 font-bold text-white shrink-0"
                data-color={arte.responsavel.avatarColor}
              >
                {arte.responsavel.initials}
              </div>
              <span className="kanban-responsavel-name">{arte.responsavel.name.split(' ')[0]}</span>
            </div>

            <div className="flex items-center gap-2">
              {arte.arquivos.length > 0 && (
                <span className="kanban-files">
                  📎 {arte.arquivos.length}
                </span>
              )}
              <span
                className="inline-block h-2-5 w-2-5 rounded-full shrink-0"
                style={{
                  background: arte.urgencia === 'HIGH' ? 'var(--red)' : arte.urgencia === 'NORMAL' ? 'var(--yellow)' : 'var(--green)',
                  boxShadow: arte.urgencia === 'HIGH'
                    ? '0 0 6px var(--red)'
                    : arte.urgencia === 'NORMAL'
                      ? '0 0 4px var(--yellow)'
                      : '0 0 4px var(--green)',
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Coluna droppable =====
function KanbanColumn({
  status,
  artes,
  onView,
}: {
  status: ArteStatus;
  artes: Arte[];
  onView: (arte: Arte) => void;
}) {
  const config = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="space-y-3">
      {/* Header da coluna com barra colorida no topo */}
      <div
        className="relative flex items-center gap-2 pb-2 pt-3 kanban-col-bar"
      >
        {/* Barra 2px topo */}
        <div
          className="absolute left-0 right-0 top-0 rounded-sm"
          style={{ height: 2, background: config.color }}
        />
        <div className="h-2 w-2 rounded-full" style={{ background: config.color }} />
        <span className="text-base font-semibold text-primary">{config.label}</span>
        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs kanban-count">
          {artes.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`space-y-3 min-h-200 rounded-xl p-1 transition-all ${
          isOver ? 'drop-zone-active' : ''
        }`}
      >
        <SortableContext items={artes.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          {artes.map((arte) => (
            <SortableArteCard key={arte.id} arte={arte} onView={onView} />
          ))}
        </SortableContext>
        {artes.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center kanban-empty">
            <Palette size={36} className="mb-2 opacity-30" />
            <p className="text-xs">Nenhuma arte aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Modal de Criação / Edição =====
function ArteFormModal({
  open,
  onClose,
  editArte,
}: {
  open: boolean;
  onClose: () => void;
  editArte?: Arte | null;
}) {
  const { data: users } = useUsers();
  const createArte = useCreateArte();
  const updateArte = useUpdateArte();
  const activeUsers = users?.filter((u) => u.active) ?? [];

  const defaultForm = {
    clienteNome: '',
    clienteNumero: '',
    orcamentoNum: '',
    produto: 'BANNER' as ProdutoTipo,
    quantidade: 1,
    largura: 0,
    altura: 0,
    responsavelId: '',
    urgencia: 'NORMAL' as Urgencia,
    prazo: '',
    observacoes: '',
  };

  const [form, setForm] = useState(defaultForm);

  // Preenche form quando editando — useEffect para reagir a mudanças de editArte
  useEffect(() => {
    if (editArte) {
      setForm({
        clienteNome: editArte.clienteNome,
        clienteNumero: editArte.clienteNumero,
        orcamentoNum: editArte.orcamentoNum,
        produto: editArte.produto,
        quantidade: editArte.quantidade,
        largura: editArte.largura,
        altura: editArte.altura,
        responsavelId: editArte.responsavelId ?? '',
        urgencia: editArte.urgencia,
        prazo: editArte.prazo ? (editArte.prazo.split('T')[0] ?? '') : '',
        observacoes: editArte.observacoes ?? '',
      });
    } else {
      setForm(defaultForm);
    }
  }, [editArte]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateArteRequest = {
      clienteNome: form.clienteNome,
      clienteNumero: form.clienteNumero,
      orcamentoNum: form.orcamentoNum,
      produto: form.produto,
      quantidade: form.quantidade,
      largura: form.largura,
      altura: form.altura,
      responsavelId: form.responsavelId,
      urgencia: form.urgencia,
      prazo: form.prazo || undefined,
      observacoes: form.observacoes || undefined,
    };

    if (editArte) {
      await updateArte.mutateAsync({ id: editArte.id, data });
    } else {
      await createArte.mutateAsync(data);
    }
    onClose();
  };

  const isPending = createArte.isPending || updateArte.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-90vh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editArte ? 'Editar Arte' : 'Nova Arte'}</DialogTitle>
          <DialogDescription>
            {editArte
              ? `Editando arte ${editArte.codigo}`
              : 'Preencha os dados para criar uma nova arte'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input
                required
                value={form.clienteNome}
                onChange={(e) => setForm({ ...form, clienteNome: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone do Cliente *</Label>
              <Input
                required
                value={form.clienteNumero}
                onChange={(e) => setForm({ ...form, clienteNumero: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* Orçamento e Produto */}
            <div className="space-y-2">
              <Label>Nº do Orçamento *</Label>
              <Input
                required
                value={form.orcamentoNum}
                onChange={(e) => setForm({ ...form, orcamentoNum: e.target.value })}
                placeholder="ORC-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Produto *</Label>
              <Select value={form.produto} onValueChange={(v) => setForm({ ...form, produto: v as ProdutoTipo })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTO_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Medidas */}
            <div className="space-y-2">
              <Label>Largura (m) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.largura || ''}
                onChange={(e) => setForm({ ...form, largura: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Altura (m) *</Label>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.altura || ''}
                onChange={(e) => setForm({ ...form, altura: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            {/* Quantidade */}
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="1"
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: parseInt(e.target.value) || 1 })}
              />
            </div>

            {/* Responsável */}
            <div className="space-y-2">
              <Label>Responsável *</Label>
              <Select value={form.responsavelId} onValueChange={(v) => setForm({ ...form, responsavelId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgência */}
            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select value={form.urgencia} onValueChange={(v) => setForm({ ...form, urgencia: v as Urgencia })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prazo */}
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                className=""
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Instruções adicionais sobre a arte..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : editArte ? 'Salvar Alterações' : 'Criar Arte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== Modal de Detalhes =====
function ArteDetailModal({
  arte,
  open,
  onClose,
  onEdit,
}: {
  arte: Arte | null;
  open: boolean;
  onClose: () => void;
  onEdit: (arte: Arte) => void;
}) {
  const deleteArte = useDeleteArte();
  const uploadArquivos = useUploadArquivos();
  const deleteArquivo = useDeleteArquivo();
  const updateStatus = useUpdateArteStatus();
  const [uploading, setUploading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'arte' | 'arquivo'; id: string; label: string } | null>(null);

  if (!arte) return null;

  const config = STATUS_CONFIG[arte.status];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      await uploadArquivos.mutateAsync({ id: arte.id, files: Array.from(files) });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = () => {
    setConfirmAction({ type: 'arte', id: arte.id, label: arte.codigo });
  };

  const handleDeleteArquivo = (arquivoId: string) => {
    setConfirmAction({ type: 'arquivo', id: arquivoId, label: 'este arquivo' });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'arte') {
      await deleteArte.mutateAsync(confirmAction.id);
      setConfirmAction(null);
      onClose();
    } else {
      await deleteArquivo.mutateAsync({ arteId: arte.id, arquivoId: confirmAction.id });
      setConfirmAction(null);
    }
  };

  // Avança status
  const currentIdx = STATUSES.indexOf(arte.status);
  const nextStatus = currentIdx < STATUSES.length - 1 ? STATUSES[currentIdx + 1] : null;
  const prevStatus = currentIdx > 0 ? STATUSES[currentIdx - 1] : null;

  const getFileIcon = (tipo: string) => {
    if (tipo.startsWith('image/')) return <ImageIcon size={16} className="text-blue" />;
    return <FileText size={16} className="text-yellow" />;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-90vh overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold font-mono text-accent">
              {arte.codigo}
            </span>
            <Badge variant={URGENCIA_CONFIG[arte.urgencia].variant}>
              {URGENCIA_CONFIG[arte.urgencia].label}
            </Badge>
            <div className="flex items-center gap-1-5 ml-auto">
              <div className="bg-dynamic h-2 w-2 rounded-full" data-color={config.color} />
              <span className="text-xs text-muted">{config.label}</span>
            </div>
          </div>
          <DialogTitle className="mt-2">{arte.clienteNome}</DialogTitle>
          <DialogDescription>
            Orçamento: {arte.orcamentoNum} · Tel: {arte.clienteNumero}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-subtle">Produto</span>
              <p className="text-primary font-medium">
                {PRODUTO_OPTIONS.find(p => p.value === arte.produto)?.label ?? arte.produto}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-subtle">Medidas</span>
              <p className="text-primary font-medium font-mono">
                {arte.largura} × {arte.altura}m
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-subtle">Quantidade</span>
              <p className="text-primary font-medium">{arte.quantidade}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-subtle">Responsável</span>
              <div className="flex items-center gap-2">
                <div
                  className="bg-dynamic flex h-6 w-6 items-center justify-center rounded-full text-10 font-bold text-white"
                  data-color={arte.responsavel.avatarColor}
                >
                  {arte.responsavel.initials}
                </div>
                <span className="text-primary">{arte.responsavel.name}</span>
              </div>
            </div>
            {arte.prazo && (
              <div className="space-y-1">
                <span className="text-muted-subtle">Prazo</span>
                <p className="text-primary font-medium">
                  {format(new Date(arte.prazo), 'dd/MM/yyyy')}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-muted-subtle">Criada em</span>
              <p className="text-primary font-medium">
                {format(new Date(arte.createdAt), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>

          {/* Observações */}
          {arte.observacoes && (
            <div className="space-y-2">
              <span className="text-sm text-muted-subtle">Observações</span>
              <p className="text-sm text-primary bg-tertiary rounded-xl border border-theme p-3">
                {arte.observacoes}
              </p>
            </div>
          )}

          {/* Arquivos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-subtle">
                Arquivos ({arte.arquivos.length})
              </span>
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.ai,.psd,.cdr,.svg"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <span className="inline-flex items-center gap-1-5 text-xs text-accent hover-text-accent transition-colors">
                  <Upload size={14} />
                  {uploading ? 'Enviando...' : 'Upload'}
                </span>
              </label>
            </div>

            {arte.arquivos.length > 0 ? (
              <div className="space-y-2">
                {arte.arquivos.map((arq) => (
                  <div
                    key={arq.id}
                    className="flex items-center justify-between rounded-lg border border-theme bg-tertiary p-2-5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(arq.tipo)}
                      <a
                        href={`${API_BASE}${arq.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover-text-accent truncate transition-colors"
                      >
                        {arq.nomeOriginal}
                      </a>
                      <span className="text-xs text-muted-subtle shrink-0">
                        {(arq.tamanho / 1024).toFixed(0)}KB
                      </span>
                    </div>
                    <button
                      title="Excluir arquivo"
                      aria-label="Excluir arquivo"
                      onClick={() => handleDeleteArquivo(arq.id)}
                      className="p-1 rounded hover-bg-red text-muted-subtle hover-text-red transition-colors shrink-0"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-subtle text-center py-4 border border-dashed border-theme rounded-xl">
                Nenhum arquivo anexado
              </p>
            )}
          </div>

          {/* Ações de status */}
          <div className="flex items-center gap-2 pt-2 border-t border-theme">
            {prevStatus && (
              <Button
                variant="ghost"
                size="lg"
                onClick={() => updateStatus.mutate({ id: arte.id, status: prevStatus })}
                disabled={updateStatus.isPending}
              >
                ← {STATUS_CONFIG[prevStatus].label}
              </Button>
            )}
            {nextStatus && (
              <Button
                size="lg"
                onClick={() => updateStatus.mutate({ id: arte.id, status: nextStatus })}
                disabled={updateStatus.isPending}
                style={{ backgroundColor: STATUS_CONFIG[nextStatus].color }}
              >
                Mover para {STATUS_CONFIG[nextStatus].label} →
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(arte);
                }}
              >
                <Edit2 size={14} />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteArte.isPending}
              >
                <Trash2 size={20} />
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* 3F — Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'arte' ? 'Excluir arte?' : 'Excluir arquivo?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === 'arte'
                ? `Tem certeza que deseja excluir a arte ${confirmAction.label}? Esta ação não pode ser desfeita.`
                : 'Tem certeza que deseja excluir este arquivo? Esta ação não pode ser desfeita.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancelar
            </Button>
            <button
              onClick={executeConfirmedAction}
              disabled={deleteArte.isPending || deleteArquivo.isPending}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors btn-delete-confirm"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ===== Página Principal =====
export function ArtesPage() {
  const { data: artes, isLoading } = useArtes();
  const { data: users } = useUsers();
  const { isAdmin } = useAuth();
  const updateStatus = useUpdateArteStatus();

  // Filtros
  const [searchText, setSearchText] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState<string>('all');
  const [filterUrgencia, setFilterUrgencia] = useState<string>('all');

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editArte, setEditArte] = useState<Arte | null>(null);
  const [detailArte, setDetailArte] = useState<Arte | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Filtra artes
  const filteredArtes = useMemo(() => {
    let result = artes ?? [];

    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (a) =>
          a.codigo.toLowerCase().includes(search) ||
          a.clienteNome.toLowerCase().includes(search) ||
          a.orcamentoNum.toLowerCase().includes(search) ||
          a.produto.toLowerCase().includes(search)
      );
    }

    if (filterResponsavel && filterResponsavel !== 'all') {
      result = result.filter((a) => a.responsavelId === filterResponsavel);
    }

    if (filterUrgencia && filterUrgencia !== 'all') {
      result = result.filter((a) => a.urgencia === filterUrgencia);
    }

    return result;
  }, [artes, searchText, filterResponsavel, filterUrgencia]);

  // Agrupa artes por status para o kanban
  const groupedArtes = useMemo(() => {
    return STATUSES.reduce((acc, status) => {
      acc[status] = filteredArtes.filter((a) => a.status === status);
      return acc;
    }, {} as Record<ArteStatus, Arte[]>);
  }, [filteredArtes]);

  // Drag & drop — TouchSensor com delay para mobile (segura 200ms para arrastar)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const activeArte = activeId ? artes?.find((a) => a.id === activeId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const arteId = active.id as string;
    const arte = artes?.find((a) => a.id === arteId);
    if (!arte) return;

    // Determina o novo status (a coluna onde foi solto)
    let newStatus: ArteStatus | null = null;

    // Se soltou diretamente numa coluna (droppable zone)
    if (STATUSES.includes(over.id as ArteStatus)) {
      newStatus = over.id as ArteStatus;
    } else {
      // Se soltou sobre outro card, pega o status desse card
      const overArte = artes?.find((a) => a.id === over.id);
      if (overArte) {
        newStatus = overArte.status;
      }
    }

    if (newStatus && newStatus !== arte.status) {
      updateStatus.mutate({ id: arteId, status: newStatus });
    }
  };

  const activeUsers = users?.filter((u) => u.active) ?? [];

  return (
    <>
      <Topbar title="Gestão de Artes" subtitle="Kanban de produção" />

      <div className="page-wrapper p-7 flex flex-col gap-5">
        {/* Toolbar */}
        <div className="artes-toolbar">
          {/* Search */}
          <div className="artes-toolbar-search relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-subtle" />
            <Input
              placeholder="Buscar por código, cliente..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters row */}
          <div className="artes-toolbar-filters">
            <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
              <SelectTrigger className="artes-filter-select">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterUrgencia} onValueChange={setFilterUrgencia}>
              <SelectTrigger className="artes-filter-select">
                <SelectValue placeholder="Urgência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas urgências</SelectItem>
                <SelectItem value="HIGH">🔴 Urgente</SelectItem>
                <SelectItem value="NORMAL">🟡 Normal</SelectItem>
                <SelectItem value="LOW">🟢 Baixa</SelectItem>
              </SelectContent>
            </Select>

            {searchText && (
              <Button variant="ghost" size="sm" onClick={() => setSearchText('')}>
                <X size={14} />
                Limpar
              </Button>
            )}
          </div>

          {/* CTA */}
          <Button size="lg" className="artes-btn-nova" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            Nova Arte
          </Button>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="kanban-board">
            {[1, 2, 3, 4].map((col) => (
              <div key={col} className="space-y-3">
                <div className="skeleton h-6 w-24" />
                <div className="skeleton h-2 w-full" />
                {[1, 2, 3].map((card) => (
                  <div key={card} className="skeleton h-32 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="kanban-board">
              {STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  artes={groupedArtes[status]}
                  onView={setDetailArte}
                />
              ))}
            </div>

            <DragOverlay>
              {activeArte && (
                <div className="opacity-90" style={{ width: 280 }}>
                  <Card style={{ borderColor: '#6c63ff', boxShadow: '0 10px 15px -3px rgba(108,99,255,0.2)' }}>
                    <CardContent className="p-4 space-y-2">
                      <span className="text-xs font-bold font-mono text-accent">
                        {activeArte.codigo}
                      </span>
                      <h4 className="text-sm font-semibold text-primary">
                        {activeArte.clienteNome}
                      </h4>
                    </CardContent>
                  </Card>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Modais */}
      <ArteFormModal
        open={showCreateModal || !!editArte}
        onClose={() => {
          setShowCreateModal(false);
          setEditArte(null);
        }}
        editArte={editArte}
      />

      <ArteDetailModal
        arte={detailArte}
        open={!!detailArte}
        onClose={() => setDetailArte(null)}
        onEdit={(arte) => {
          setDetailArte(null);
          setEditArte(arte);
        }}
      />
    </>
  );
}
