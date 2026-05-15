import { useState } from 'react';
import { format } from 'date-fns';
import { Edit2, FileText, ImageIcon, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { API_BASE } from '@/services/api';
import { useDeleteArquivo, useDeleteArte, useUpdateArteStatus, useUploadArquivos } from '@/hooks/useArtes';
import type { Arte, ArteStatus, Urgencia } from '@/types';
import { LOJA_LABELS } from '@/utils/lojas';
import { PRODUTO_LABELS } from '@/utils/arteAnalytics';

const STATUS_CONFIG: Record<ArteStatus, { label: string; color: string }> = {
  TODO: { label: 'A Fazer', color: '#6c63ff' },
  DOING: { label: 'Fazendo', color: '#4db8ff' },
  REVIEW: { label: 'Revisão', color: '#f5c542' },
  DONE: { label: 'Concluído', color: '#22d3a0' },
};

const URGENCIA_CONFIG: Record<Urgencia, { label: string; variant: 'info' | 'default' | 'danger' }> = {
  LOW: { label: 'Baixa', variant: 'info' },
  NORMAL: { label: 'Normal', variant: 'default' },
  HIGH: { label: 'Urgente', variant: 'danger' },
};

const STATUSES: ArteStatus[] = ['TODO', 'DOING', 'REVIEW', 'DONE'];

export function ArteDetailDialog({
  arte,
  open,
  onClose,
  onEdit,
  showActions = false,
}: {
  arte: Arte | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (arte: Arte) => void;
  showActions?: boolean;
}) {
  const deleteArte = useDeleteArte();
  const uploadArquivos = useUploadArquivos();
  const deleteArquivo = useDeleteArquivo();
  const updateStatus = useUpdateArteStatus();
  const [uploading, setUploading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'arte' | 'arquivo'; id: string; label: string } | null>(null);

  if (!arte) return null;

  const config = STATUS_CONFIG[arte.status];
  const currentIdx = STATUSES.indexOf(arte.status);
  const nextStatus = currentIdx < STATUSES.length - 1 ? STATUSES[currentIdx + 1] : null;
  const prevStatus = currentIdx > 0 ? STATUSES[currentIdx - 1] : null;

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

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'arte') {
      await deleteArte.mutateAsync(confirmAction.id);
      setConfirmAction(null);
      onClose();
      return;
    }

    await deleteArquivo.mutateAsync({ arteId: arte.id, arquivoId: confirmAction.id });
    setConfirmAction(null);
  };

  const getFileIcon = (tipo: string) => {
    if (tipo.startsWith('image/')) return <ImageIcon size={16} className="text-blue" />;
    return <FileText size={16} className="text-yellow" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DialogContent className="max-w-2xl max-h-90vh overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold font-mono text-accent">{arte.codigo}</span>
              <Badge variant={URGENCIA_CONFIG[arte.urgencia].variant}>{URGENCIA_CONFIG[arte.urgencia].label}</Badge>
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
            <div className="grid grid-cols-2 gap-4 text-sm arte-detail-grid">
              <div className="space-y-1">
                <span className="text-muted-subtle">Produto</span>
                <p className="text-primary font-medium">{PRODUTO_LABELS[arte.produto] ?? arte.produto}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-subtle">Medidas</span>
                <p className="text-primary font-medium font-mono">{arte.larguraCm} × {arte.alturaCm}cm</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-subtle">Quantidade</span>
                <p className="text-primary font-medium">{arte.quantidade}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-subtle">Responsável</span>
                <div className="flex items-center gap-2">
                  <div className="bg-dynamic flex h-6 w-6 items-center justify-center rounded-full text-10 font-bold text-white" data-color={arte.responsavel.avatarColor}>
                    {arte.responsavel.initials}
                  </div>
                  <span className="text-primary">{arte.responsavel.name}</span>
                  <span className="text-xs text-muted-subtle">· {LOJA_LABELS[arte.responsavel.loja]}</span>
                </div>
              </div>
              {arte.prazo && (
                <div className="space-y-1">
                  <span className="text-muted-subtle">Prazo</span>
                  <p className="text-primary font-medium">{format(new Date(arte.prazo), 'dd/MM/yyyy')}</p>
                </div>
              )}
              <div className="space-y-1">
                <span className="text-muted-subtle">Criada em</span>
                <p className="text-primary font-medium">{format(new Date(arte.createdAt), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            {arte.observacoes && (
              <div className="space-y-2">
                <span className="text-sm text-muted-subtle">Observações</span>
                <p className="text-sm text-primary bg-tertiary rounded-xl border border-theme p-3">{arte.observacoes}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-subtle">Arquivos ({arte.arquivos.length})</span>
                {showActions && (
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
                )}
              </div>

              {arte.arquivos.length > 0 ? (
                <div className="space-y-2">
                  {arte.arquivos.map((arq) => (
                    <div key={arq.id} className="flex items-center justify-between rounded-lg border border-theme bg-tertiary p-2-5">
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
                        <span className="text-xs text-muted-subtle shrink-0">{(arq.tamanho / 1024).toFixed(0)}KB</span>
                      </div>
                      {showActions && (
                        <button
                          title="Excluir arquivo"
                          aria-label="Excluir arquivo"
                          onClick={() => setConfirmAction({ type: 'arquivo', id: arq.id, label: 'este arquivo' })}
                          className="p-1 rounded hover-bg-red text-muted-subtle hover-text-red transition-colors shrink-0"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-subtle text-center py-4 border border-dashed border-theme rounded-xl">Nenhum arquivo anexado</p>
              )}
            </div>

            {showActions ? (
              <div className="flex items-center gap-2 pt-2 border-t border-theme arte-detail-actions">
                {prevStatus && (
                  <Button variant="ghost" size="lg" onClick={() => updateStatus.mutate({ id: arte.id, status: prevStatus })} disabled={updateStatus.isPending}>
                    ← {STATUS_CONFIG[prevStatus].label}
                  </Button>
                )}
                {nextStatus && (
                  <Button size="lg" onClick={() => updateStatus.mutate({ id: arte.id, status: nextStatus })} disabled={updateStatus.isPending} style={{ backgroundColor: STATUS_CONFIG[nextStatus].color }}>
                    Mover para {STATUS_CONFIG[nextStatus].label} →
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {onEdit && (
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
                  )}
                  <Button variant="destructive" size="sm" onClick={() => setConfirmAction({ type: 'arte', id: arte.id, label: arte.codigo })} disabled={deleteArte.isPending}>
                    <Trash2 size={20} />
                    Excluir
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {showActions && (
        <Dialog open={!!confirmAction} onOpenChange={(nextOpen) => !nextOpen && setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {confirmAction?.type === 'arte' ? 'Excluir arte?' : 'Excluir arquivo?'}
              </DialogTitle>
              <DialogDescription>
                {confirmAction?.type === 'arte'
                  ? `Esta ação removerá ${confirmAction?.label} permanentemente.`
                  : `Deseja remover ${confirmAction?.label}?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={executeConfirmedAction} disabled={deleteArte.isPending || deleteArquivo.isPending}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
