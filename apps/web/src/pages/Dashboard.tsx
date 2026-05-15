import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Clock, TrendingUp, AlertTriangle, CheckCircle, Users, Eye, CheckSquare, ClipboardList, BarChart3, CalendarDays, Factory, ArrowRight, DollarSign, FileSpreadsheet } from 'lucide-react';
import { usePontos } from '@/hooks/usePonto';
import { useArtes } from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { useChecklistHoje } from '@/hooks/useChecklist';
import { useVendas } from '@/hooks/useVendas';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth } from 'date-fns';
import type { Arte, Ponto } from '@/types';
import { formatarHora, getAgoraSP } from '@/utils/timezone';
import { PRODUTO_LABELS } from '@/utils/arteAnalytics';

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
  const { data: vendas } = useVendas();
  const navigate = useNavigate();

  const greeting = () => {
    const hour = getAgoraSP().hour;
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Data de hoje no fuso de São Paulo (YYYY-MM-DD)
  const spNow = getAgoraSP();
  const todayLocal = spNow.toFormat('yyyy-MM-dd');

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
  const clPendentes = clTotal - clFeitos;
  const ausentesHoje = Math.max(0, totalFuncionarios - new Set(pontosHoje.filter((p) => !!p.entrada).map((p) => p.userId)).size);
  const meuPontoHoje = pontosHoje.find((p) => p.userId === user?.id) ?? null;
  const minhasArtesAtivas = (artes ?? []).filter((arte) => arte.responsavelId === user?.id && arte.status !== 'DONE');
  const minhasUrgentes = minhasArtesAtivas.filter((arte) => arte.urgencia === 'HIGH').length;
  const visibleVendas = (vendas ?? []).filter((venda) => isAdmin || venda.responsavelId === user?.id);
  const vendasHoje = visibleVendas.filter((venda) => (venda.createdAt ?? '').slice(0, 10) === todayLocal);
  const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const vendasMes = visibleVendas.filter((venda) => (venda.createdAt ?? '').slice(0, 10) >= inicioMes);
  const receitaHoje = vendasHoje.filter((venda) => venda.status === 'CONCLUIDA').reduce((sum, venda) => sum + venda.valorTotal, 0);
  const receitaMes = vendasMes.filter((venda) => venda.status === 'CONCLUIDA').reduce((sum, venda) => sum + venda.valorTotal, 0);

  const quickActions = isAdmin
    ? [
        { title: 'Gestão de pontos', description: 'Revisar presença, folgas e ajustes do dia.', to: '/gestao-pontos', icon: ClipboardList, color: 'var(--accent)' },
        { title: 'Analytics', description: 'Acompanhar méritos, faltas e atrasos da equipe.', to: '/ponto/analytics', icon: BarChart3, color: 'var(--blue)' },
        { title: 'Agenda', description: 'Priorizar prazos, urgências e carga por responsável.', to: '/agenda-producao', icon: CalendarDays, color: 'var(--yellow)' },
        { title: 'Operação', description: 'Ler gargalos, revisão e distribuição atual.', to: '/gestao-operacional', icon: Factory, color: 'var(--green)' },
        { title: 'Relatório', description: 'Cruzar vendas, pontos e produtividade em um só painel.', to: '/relatorio', icon: FileSpreadsheet, color: 'var(--blue)' },
      ]
    : [
        { title: 'Registrar ponto', description: 'Abrir sua jornada e acompanhar o expediente.', to: '/ponto', icon: Clock, color: 'var(--accent)' },
        { title: 'Checklist diário', description: 'Conferir pendências e concluir a rotina do dia.', to: '/checklist', icon: CheckSquare, color: 'var(--blue)' },
        { title: 'Artes', description: 'Ver suas demandas e atualizar o Kanban.', to: '/artes', icon: Palette, color: 'var(--yellow)' },
      ];

  const resumoInteligente = isAdmin
    ? [
        {
          id: 'equipe-hoje',
          titulo: 'Equipe hoje',
          descricao: `${funcionariosTrabalhando} trabalhando e ${ausentesHoje} ausente(s) no momento.`,
          acao: 'Abrir gestão de pontos',
          to: '/gestao-pontos',
        },
        {
          id: 'producao-critica',
          titulo: 'Produção crítica',
          descricao: `${artesUrgentes.length} urgência(s) e ${artesReview} peça(s) em revisão aguardando atenção.`,
          acao: 'Ir para agenda',
          to: '/agenda-producao',
        },
        {
          id: 'checklist-hoje',
          titulo: 'Checklist do dia',
          descricao: `${clFeitos}/${clTotal} itens concluídos${clPendentes > 0 ? `, com ${clPendentes} pendente(s)` : ' e rotina em dia'}.`,
          acao: 'Ver checklist',
          to: '/checklist',
        },
      ]
    : [
        {
          id: 'meu-ponto',
          titulo: 'Minha jornada',
          descricao: meuPontoHoje?.saida
            ? 'Seu ponto de hoje já foi concluído.'
            : meuPontoHoje?.entrada
              ? 'Seu expediente está em andamento. Confira a próxima batida.'
              : 'Você ainda não registrou sua entrada hoje.',
          acao: 'Abrir ponto',
          to: '/ponto',
        },
        {
          id: 'meu-checklist',
          titulo: 'Minha rotina',
          descricao: `${clFeitos}/${clTotal} item(ns) do checklist concluídos hoje.`,
          acao: 'Abrir checklist',
          to: '/checklist',
        },
        {
          id: 'minhas-artes',
          titulo: 'Minhas artes',
          descricao: `${minhasArtesAtivas.length} demanda(s) ativas${minhasUrgentes > 0 ? `, sendo ${minhasUrgentes} urgente(s)` : ''}.`,
          acao: 'Abrir artes',
          to: '/artes',
        },
      ];

  // Artes em andamento (DOING + REVIEW)
  const artesDoingList = artes?.filter((a: Arte) => a.status === 'DOING' || a.status === 'REVIEW') ?? [];

  return (
    <>
      <Topbar title={`${greeting()}, ${user?.name?.split(' ')[0]}!`} />

      <div className="page-wrapper dashboard-page p-7 flex flex-col gap-5">

        {/* ===== STAT CARDS ===== */}
        <div className="dash-stats-grid dashboard-stats-grid">
          {isAdmin && (
            <div className="dash-stat-card dash-stat-blue interactive-card" data-glow="blue" onClick={() => navigate('/gestao-pontos')}>
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

          <div className="dash-stat-card dash-stat-yellow interactive-card" data-glow="yellow" onClick={() => navigate(isAdmin ? '/agenda-producao' : '/artes')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow">
              <TrendingUp size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesEmAndamento}</span>
              <span className="dash-stat-label">Em produção</span>
            </div>
          </div>

          <div className="dash-stat-card dash-stat-red interactive-card" data-glow="red" onClick={() => navigate('/artes')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-red">
              <AlertTriangle size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesUrgentes.length}</span>
              <span className="dash-stat-label">Urgentes</span>
            </div>
          </div>

          <div className="dash-stat-card dash-stat-purple interactive-card" data-glow="accent" onClick={() => navigate(isAdmin ? '/gestao-operacional' : '/artes')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-purple">
              <Eye size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesReview}</span>
              <span className="dash-stat-label">Em revisão</span>
            </div>
          </div>

          <div className="dash-stat-card dash-stat-green interactive-card" data-glow="green" onClick={() => navigate('/artes')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-green">
              <CheckCircle size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesConcluidasHoje}</span>
              <span className="dash-stat-label">Concluídas hoje</span>
            </div>
          </div>

          <div
            className="dash-stat-card dash-stat-teal interactive-card"
            data-glow="green"
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

          <div className="dash-stat-card dash-stat-blue interactive-card" data-glow="blue" onClick={() => navigate('/relatorio?preset=day&focus=sales')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-blue">
              <DollarSign size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{vendasHoje.length}</span>
              <span className="dash-stat-label">Vendas hoje</span>
            </div>
            <span className="dash-stat-sub">R$ {receitaHoje.toFixed(2)}</span>
          </div>

          <div className="dash-stat-card dash-stat-purple interactive-card" data-glow="accent" onClick={() => navigate('/relatorio?preset=month&focus=sales')}>
            <div className="dash-stat-icon-wrap dash-stat-icon-purple">
              <FileSpreadsheet size={18} />
            </div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">R$ {receitaMes.toFixed(2)}</span>
              <span className="dash-stat-label">Receita no mês</span>
            </div>
            <span className="dash-stat-sub">{vendasMes.length} registro(s)</span>
          </div>
        </div>

        <div className="dash-action-grid">
          {quickActions.map((action) => (
            <Card key={action.to}>
              <CardContent className="dash-action-card p-5 interactive-card" data-glow="accent" onClick={() => navigate(action.to)}>
                <div className="dash-action-head">
                  <div className="dash-action-body">
                    <div className="dash-action-icon" style={{ background: 'var(--bg3)', color: action.color }}>
                      <action.icon size={18} />
                    </div>
                    <div className="dash-action-copy">
                      <div className="dash-action-title">{action.title}</div>
                      <div className="dash-action-description">{action.description}</div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="dash-action-arrow" style={{ color: 'var(--text3)' }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <div className="dash-section-header">
            <div className="dash-section-icon dash-section-icon-arte">
              <AlertTriangle size={16} />
            </div>
            <h3 className="dash-section-title">Resumo Inteligente</h3>
            <span className="dash-section-count">{resumoInteligente.length}</span>
          </div>
          <CardContent className="dash-section-body">
            <div className="smart-summary-grid">
              {resumoInteligente.map((item) => (
                <div key={item.id} className="smart-summary-card interactive-card" data-glow="accent">
                  <div>
                    <div className="smart-summary-title">{item.titulo}</div>
                    <div className="smart-summary-text">{item.descricao}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="smart-summary-link inline-flex items-center gap-2"
                  >
                    {item.acao}
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
                    const entradaFmt = ponto.entrada ? formatarHora(ponto.entrada) : '--:--';
                    const saidaFmt = ponto.saida ? formatarHora(ponto.saida) : null;

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
