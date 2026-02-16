import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useHardDeleteUser } from '@/hooks/useUsers';
import { usePontos } from '@/hooks/usePonto';
import { useArtes } from '@/hooks/useArtes';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/stores/toastStore';
import type { User, Role, CreateUserRequest, Ponto, Arte } from '@/types';
import {
  Plus,
  Edit2,
  UserX,
  UserCheck,
  Shield,
  ShieldCheck,
  Users as UsersIcon,
  Palette,
  Trash2,
} from 'lucide-react';

const AVATAR_COLORS = [
  '#6c63ff', '#22d3a0', '#f5c542', '#ff5e5e', '#4db8ff',
  '#e879f9', '#fb923c', '#a78bfa', '#34d399', '#f472b6',
];

const ROLE_CONFIG: Record<Role, { label: string; color: string; icon: typeof Shield }> = {
  ADMIN: { label: 'Administrador', color: '#f5c542', icon: ShieldCheck },
  EMPLOYEE: { label: 'Funcionário', color: '#4db8ff', icon: Shield },
};

// ===== Modal de Criação / Edição =====
function UserFormModal({
  open,
  onClose,
  editUser,
}: {
  open: boolean;
  onClose: () => void;
  editUser?: User | null;
}) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [form, setForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: Role;
    avatarColor: string;
  }>({
    name: editUser?.name ?? '',
    email: editUser?.email ?? '',
    password: '',
    role: editUser?.role ?? 'EMPLOYEE',
    avatarColor: editUser?.avatarColor ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? '#6c63ff',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editUser) {
      const updateData: Partial<CreateUserRequest> & { active?: boolean } = {
        name: form.name,
        email: form.email,
        role: form.role,
        avatarColor: form.avatarColor,
      };
      if (form.password) updateData.password = form.password;
      await updateUser.mutateAsync({ id: editUser.id, data: updateData });
    } else {
      await createUser.mutateAsync({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        avatarColor: form.avatarColor,
      });
    }

    onClose();
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'EMPLOYEE',
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? '#6c63ff',
    });
  };

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editUser ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
          <DialogDescription>
            {editUser
              ? `Editando dados de ${editUser.name}`
              : 'Preencha os dados para cadastrar um novo funcionário'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome do funcionário"
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail *</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@graficaos.com"
            />
          </div>

          <div className="space-y-2">
            <Label>{editUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}</Label>
            <Input
              type="password"
              required={!editUser}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editUser ? '••••••••' : 'Senha do funcionário'}
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label>Perfil *</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Funcionário</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cor do Avatar</Label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={`Selecionar cor ${color}`}
                  aria-label={`Selecionar cor ${color}`}
                  onClick={() => setForm({ ...form, avatarColor: color })}
                  className={`bg-dynamic h-8 w-8 rounded-full transition-all ${
                    form.avatarColor === color
                      ? 'ring-2 ring-white ring-offset-2 scale-110'
                      : 'hover-scale-105'
                  }`}
                  data-color={color}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : editUser ? 'Salvar Alterações' : 'Criar Funcionário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== Página Principal =====
export function FuncionariosPage() {
  const { data: users, isLoading } = useUsers();
  const { data: allPontos } = usePontos();
  const { data: artes } = useArtes();
  const deleteUser = useDeleteUser();
  const hardDeleteUser = useHardDeleteUser();
  const updateUser = useUpdateUser();
  const { user: currentUser } = useAuth();
  const addToast = useToastStore.getState().addToast;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string; active: boolean } | null>(null);

  const activeUsers = users?.filter((u) => u.active) ?? [];
  const allUsers = users ?? [];

  // Pontos de hoje para calcular status
  const pontosHoje = allPontos?.filter((p: Ponto) => {
    return new Date(p.date).toDateString() === new Date().toDateString();
  }) ?? [];

  // Artes ativas por responsável
  const artesAtivas = artes?.filter((a: Arte) => a.status !== 'DONE') ?? [];

  // Stats
  const totalCount = allUsers.length;
  const activeCount = activeUsers.length;
  const presentesToday = pontosHoje.filter((p) => p.entrada).length;
  const artesAtivasTotal = artesAtivas.length;
  const ausentesHoje = activeCount - presentesToday;

  const handleRemove = (u: User) => {
    setConfirmRemove({ id: u.id, name: u.name, active: u.active });
  };

  const executeDeactivate = async () => {
    if (!confirmRemove) return;
    await deleteUser.mutateAsync(confirmRemove.id);
    setConfirmRemove(null);
  };

  const executeHardDelete = async () => {
    if (!confirmRemove) return;
    await hardDeleteUser.mutateAsync(confirmRemove.id);
    setConfirmRemove(null);
  };

  const handleReactivate = async (userId: string) => {
    await updateUser.mutateAsync({ id: userId, data: { active: true } });
    addToast({ icon: '✅', title: 'Funcionário reativado' });
  };

  // Funções auxiliares para status do ponto
  function getUserPontoStatus(userId: string): { label: string; color: string; dimColor: string } {
    const ponto = pontosHoje.find((p) => p.userId === userId);
    if (!ponto || !ponto.entrada) return { label: 'Ausente', color: 'var(--red)', dimColor: 'var(--red-dim)' };
    if (ponto.saida) return { label: 'Completo', color: 'var(--green)', dimColor: 'var(--green-dim)' };
    if (ponto.almoco && !ponto.retorno) return { label: 'Almoço', color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' };
    return { label: 'Trabalhando', color: 'var(--blue)', dimColor: 'var(--blue-dim)' };
  }

  function getUserArtesAtivas(userId: string): number {
    return artesAtivas.filter((a) => a.responsavelId === userId).length;
  }

  function formatDesde(createdAt: string): string {
    const date = new Date(createdAt);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  return (
    <>
      <Topbar title="Funcionários" />

      <div className="page-wrapper p-7 flex flex-col gap-6">
        {/* Stat cards */}
        <div className="dash-stats-grid">
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><UsersIcon size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{totalCount}</span>
              <span className="dash-stat-label">Total de funcionários</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><UserCheck size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{presentesToday}</span>
              <span className="dash-stat-label">Presentes hoje</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow"><Palette size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesAtivasTotal}</span>
              <span className="dash-stat-label">Artes ativas</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-red">
            <div className="dash-stat-icon-wrap dash-stat-icon-red"><UserX size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{ausentesHoje > 0 ? ausentesHoje : 0}</span>
              <span className="dash-stat-label">Ausentes hoje</span>
            </div>
          </div>
        </div>

        {/* Header + Botão novo */}
        <div className="flex items-center justify-between">
          <h3
            className="section-title"
          >
            Equipe
          </h3>
          <Button onClick={() => setShowCreateModal(true)} size="lg">
            <Plus size={20} />
            Novo Funcionário
          </Button>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-12 w-full" />
                ))}
              </div>
            ) : allUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
                <UserX size={36} className="mb-2 opacity-30" />
                <p className="text-sm">Nenhum funcionário cadastrado.</p>
              </div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className="w-full text-left table-text">
                  <thead>
                    <tr className="table-header-row">
                      {['NOME', 'CARGO', 'STATUS HOJE', 'ARTES ATIVAS', 'DESDE', 'AÇÕES'].map((h) => (
                        <th
                          key={h}
                          className="th-cell"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u) => {
                      const pontoStatus = getUserPontoStatus(u.id);
                      const artesCount = getUserArtesAtivas(u.id);
                      const roleConfig = ROLE_CONFIG[u.role];

                      return (
                        <tr
                          key={u.id}
                          className={`transition-colors ${!u.active ? 'opacity-50' : ''} table-body-row`}
                        >
                          {/* NOME */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="bg-dynamic flex h-9 w-9 items-center justify-center rounded-full text-10 font-bold text-white shrink-0"
                                data-color={u.avatarColor}
                              >
                                {u.initials}
                              </div>
                              <div>
                                <span className="block text-21 font-semibold dash-name">
                                  {u.name}
                                </span>
                                <span className="block text-19 text-muted">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* CARGO */}
                          <td className="py-3 px-4">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2-5 py-1 text-18 font-semibold font-mono tracking-wide"
                              style={{
                                background: `color-mix(in srgb, ${roleConfig.color} 15%, transparent)`,
                                color: roleConfig.color,
                                border: `1px solid ${roleConfig.color}`,
                              }}
                            >
                              {roleConfig.label}
                            </span>
                          </td>

                          {/* STATUS HOJE */}
                          <td className="py-3 px-4">
                            {u.active ? (
                              <span
                                className="inline-block rounded-full px-2-5 py-1 text-18 font-semibold font-mono tracking-wide"
                                style={{
                                  background: pontoStatus.dimColor,
                                  color: pontoStatus.color,
                                  border: `1px solid ${pontoStatus.color}`,
                                }}
                              >
                                {pontoStatus.label}
                              </span>
                            ) : (
                              <span
                                className="inline-block rounded-full px-2-5 py-1 text-18 font-semibold font-mono kanban-atrasado"
                              >
                                Inativo
                              </span>
                            )}
                          </td>

                          {/* ARTES ATIVAS */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold" style={{ color: artesCount > 0 ? 'var(--accent)' : 'var(--text3)' }}>
                              {artesCount}
                            </span>
                          </td>

                          {/* DESDE */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-20 text-secondary">
                              {formatDesde(u.createdAt)}
                            </span>
                          </td>

                          {/* AÇÕES */}
                          <td className="py-3 px-4">
                            {u.id !== currentUser?.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditUser(u)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover-bg-subtle text-secondary"
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                                {!u.active && (
                                  <button
                                    onClick={() => handleReactivate(u.id)}
                                    disabled={updateUser.isPending}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover-bg-green text-green"
                                    title="Reativar"
                                  >
                                    <UserCheck size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemove(u)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover-bg-red text-red"
                                  title="Remover"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <span
                                className="inline-block rounded-full px-2 py-0-5 text-18 font-semibold font-mono tag-hoje"
                              >
                                Você
                              </span>
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
      </div>

      {/* Modais */}
      <UserFormModal
        open={showCreateModal || !!editUser}
        onClose={() => {
          setShowCreateModal(false);
          setEditUser(null);
        }}
        editUser={editUser}
      />

      {/* Confirm Dialog para remoção — 3 opções */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover funcionário</DialogTitle>
            <DialogDescription>
              O que deseja fazer com <strong>{confirmRemove?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {confirmRemove?.active && (
              <button
                onClick={executeDeactivate}
                disabled={deleteUser.isPending}
                className="func-action-btn func-action-deactivate"
              >
                <UserX size={16} />
                <div className="func-action-btn-text">
                  <span className="func-action-btn-title">Desativar</span>
                  <span className="func-action-btn-desc">O funcionário não poderá acessar o sistema, mas os dados serão mantidos.</span>
                </div>
              </button>
            )}
            <button
              onClick={executeHardDelete}
              disabled={hardDeleteUser.isPending}
              className="func-action-btn func-action-delete"
            >
              <Trash2 size={16} />
              <div className="func-action-btn-text">
                <span className="func-action-btn-title">Excluir permanentemente</span>
                <span className="func-action-btn-desc">Remove o funcionário e todos os registros associados. Ação irreversível.</span>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
