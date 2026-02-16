import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Clock, TrendingUp, AlertTriangle, CheckCircle, Users, Eye, CheckSquare } from 'lucide-react';
import { usePontos } from '@/hooks/usePonto';
import { useArtes } from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { useChecklistHoje } from '@/hooks/useChecklist';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { Arte, Ponto, ProdutoTipo } from '@/types';

const PRODUTO_LABELS: Record<ProdutoTipo, string> = {
  AZULEJO: 'Azulejo',
  BANNER: 'Banner',
  ADESIVO: 'Adesivo',
  PLACA: 'Placa',
  FAIXA: 'Faixa',
  OUTRO: 'Outro',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DOING: { label: 'Produção', color: 'var(--blue)' },
  REVIEW: { label: 'Revisão', color: 'var(--yellow)' },
};

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data: artes } = useArtes();
  const { data: allPontos } = usePontos();
  const { data: users } = useUsers();
  const { data: checklistHoje } = useChecklistHoje();
  const navigate = useNavigate();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Data de hoje no fuso local (YYYY-MM-DD)
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Pontos de hoje
  const pontosHoje = allPontos?.filter((p: Ponto) => {
    return p.date.slice(0, 10) === todayLocal;
  }) ?? [];

  // Stats
  const funcionariosTrabalhando = pontosHoje.filter((p) => p.entrada && !p.saida).length;
  const totalFuncionarios = users?.filter(u => u.active).length ?? 0;
  const artesEmAndamento = artes?.filter((a: Arte) => a.status === 'DOING').length ?? 0;
  const artesUrgentes = artes?.filter((a: Arte) => a.urgencia === 'HIGH' && a.status !== 'DONE') ?? [];
  const artesReview = artes?.filter((a: Arte) => a.status === 'REVIEW').length ?? 0;
  const artesConcluidasHoje = artes?.filter((a: Arte) => a.status === 'DONE' && a.updatedAt.slice(0, 10) === todayLocal).length ?? 0;

  // Checklist stats
  const clTotal = checklistHoje?.length ?? 0;
  const clFeitos = checklistHoje?.filter((i) => i.feito).length ?? 0;
  const clPct = clTotal > 0 ? Math.round((clFeitos / clTotal) * 100) : 0;

  // Artes em andamento (DOING + REVIEW)
  const artesDoingList = artes?.filter((a: Arte) => a.status === 'DOING' || a.status === 'REVIEW') ?? [];

  return (
    <>
      <Topbar title={`${greeting()}, ${user?.name?.split(' ')[0]}!`} />

      <div className="page-wrapper p-7 flex flex-col gap-5">

        {/* ===== STAT CARDS ===== */}
        <div className="dash-stats-grid">
          {isAdmin && (
            <div className="dash-stat-card dash-stat-blue">
              <div className="dash-stat-icon-wrap dash-stat-icon-blue">
                <Users size={18} />
              </div>
              <div className="dash-stat-info">
                <span className="dash-stat-number">{funcionariosTrabalhando}</span>
                <span className="dash-stat-label">Trabalhando</span>
              </div>
              <span className="dash-stat-sub">{totalFuncionarios} total</span>
            </div>
          )}

          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow">
              <TrendingUp size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesEmAndamento}</span>
              <span className="dash-stat-label">Em produção</span>
            </div>
          </div>

          <div className="dash-stat-card dash-stat-red">
            <div className="dash-stat-icon-wrap dash-stat-icon-red">
              <AlertTriangle size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesUrgentes.length}</span>
              <span className="dash-stat-label">Urgentes</span>
            </div>
          </div>

          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple">
              <Eye size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesReview}</span>
              <span className="dash-stat-label">Em revisão</span>
            </div>
          </div>

          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green">
              <CheckCircle size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesConcluidasHoje}</span>
              <span className="dash-stat-label">Concluídas hoje</span>
            </div>
          </div>

          <div
            className="dash-stat-card dash-stat-teal"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/checklist')}
          >
            <div className="dash-stat-icon-wrap dash-stat-icon-teal">
              <CheckSquare size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{clPct}%</span>
              <span className="dash-stat-label">Checklist Hoje</span>
            </div>
            <span className="dash-stat-sub">{clFeitos}/{clTotal} itens</span>
          </div>
        </div>

        {/* ===== DUAS COLUNAS ===== */}
        <div className="two-col-grid grid gap-5 lg-grid-cols-2">

          {/* PONTOS HOJE */}
          <Card>
            <div className="dash-section-header">
              <div className="dash-section-icon">
                <Clock size={16} />
              </div>
              <h3 className="dash-section-title">Pontos Hoje</h3>
              <span className="dash-section-count">{pontosHoje.length}</span>
            </div>
            <CardContent className="dash-section-body">
              {pontosHoje.length === 0 ? (
                <div className="dash-empty-state">
                  <Clock size={32} className="dash-empty-icon" />
                  <p>Nenhum registro hoje</p>
                </div>
              ) : (
                <div className="dash-list">
                  {pontosHoje.map((ponto) => {
                    const entradaFmt = ponto.entrada ? format(new Date(ponto.entrada), 'HH:mm') : '--:--';
                    const saidaFmt = ponto.saida ? format(new Date(ponto.saida), 'HH:mm') : null;

                    let statusLabel = 'Aguardando';
                    let dotColor = 'var(--text3)';
                    if (ponto.saida) { statusLabel = 'Completo'; dotColor = 'var(--green)'; }
                    else if (ponto.retorno) { statusLabel = 'Trabalhando'; dotColor = 'var(--green)'; }
                    else if (ponto.almoco) { statusLabel = 'Almoço'; dotColor = 'var(--yellow)'; }
                    else if (ponto.entrada) { statusLabel = 'Trabalhando'; dotColor = 'var(--blue)'; }

                    return (
                      <div key={ponto.id} className="dash-list-item">
                        <div
                          className="bg-dynamic dash-avatar"
                          data-color={ponto.user.avatarColor}
                        >
                          {ponto.user.initials}
                        </div>
                        <div className="dash-list-content">
                          <span className="dash-list-name">{ponto.user.name}</span>
                          <span className="dash-list-detail">
                            {entradaFmt}{saidaFmt ? ` → ${saidaFmt}` : ''}
                          </span>
                        </div>
                        <div className="dash-list-status">
                          <span
                            className="dash-status-dot"
                            style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                          />
                          <span className="dash-status-label" style={{ color: dotColor }}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ARTES EM ANDAMENTO */}
          <Card>
            <div className="dash-section-header">
              <div className="dash-section-icon dash-section-icon-arte">
                <Palette size={16} />
              </div>
              <h3 className="dash-section-title">Artes em Andamento</h3>
              <span className="dash-section-count">{artesDoingList.length}</span>
            </div>
            <CardContent className="dash-section-body">
              {artesDoingList.length === 0 ? (
                <div className="dash-empty-state">
                  <Palette size={32} className="dash-empty-icon" />
                  <p>Nenhuma arte em produção</p>
                </div>
              ) : (
                <div className="dash-list">
                  {artesDoingList.slice(0, 8).map((arte) => {
                    const urgencyColor =
                      arte.urgencia === 'HIGH' ? 'var(--red)' : arte.urgencia === 'NORMAL' ? 'var(--yellow)' : 'var(--green)';
                    const statusConf = STATUS_LABELS[arte.status] ?? { label: arte.status, color: 'var(--text3)' };

                    return (
                      <div key={arte.id} className="dash-list-item">
                        <div className="dash-arte-status-bar" style={{ background: statusConf.color }} />
                        <div className="dash-list-content">
                          <div className="dash-arte-row1">
                            <span className="dash-list-name">{arte.clienteNome}</span>
                            {arte.urgencia === 'HIGH' && (
                              <span className="dash-urgente-tag">
                                <AlertTriangle size={10} />
                                Urgente
                              </span>
                            )}
                          </div>
                          <div className="dash-arte-row2">
                            <span className="dash-arte-code">{arte.codigo}</span>
                            <span className="dash-arte-sep">·</span>
                            <span>{PRODUTO_LABELS[arte.produto] ?? arte.produto}</span>
                            {arte.quantidade > 1 && <span className="dash-arte-qty">×{arte.quantidade}</span>}
                          </div>
                          <div className="dash-arte-row3">
                            <div
                              className="bg-dynamic dash-avatar-sm"
                              data-color={arte.responsavel.avatarColor}
                            >
                              {arte.responsavel.initials}
                            </div>
                            <span>{arte.responsavel.name.split(' ')[0]}</span>
                            <span className="dash-arte-status-tag" style={{ color: statusConf.color, borderColor: statusConf.color }}>
                              {statusConf.label}
                            </span>
                          </div>
                        </div>
                        <span
                          className="dash-urgency-dot"
                          style={{ background: urgencyColor, boxShadow: `0 0 6px ${urgencyColor}` }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
