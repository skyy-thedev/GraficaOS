import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Clock } from 'lucide-react';
import { usePontos } from '@/hooks/usePonto';
import { useArtes } from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
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

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data: artes } = useArtes();
  const { data: allPontos } = usePontos();
  const { data: users } = useUsers();

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
  // p.date vem do Prisma @db.Date como "YYYY-MM-DDT00:00:00.000Z" (meia-noite UTC)
  // Usamos slice(0,10) para extrair a data do banco e comparamos com a data local do cliente
  const pontosHoje = allPontos?.filter((p: Ponto) => {
    return p.date.slice(0, 10) === todayLocal;
  }) ?? [];

  // Stats
  const funcionariosTrabalhando = pontosHoje.filter((p) => p.entrada && !p.saida).length;
  const artesEmAndamento = artes?.filter((a: Arte) => a.status === 'DOING').length ?? 0;
  const artesUrgentes = artes?.filter((a: Arte) => a.urgencia === 'HIGH' && a.status !== 'DONE') ?? [];
  const artesReview = artes?.filter((a: Arte) => a.status === 'REVIEW').length ?? 0;
  const artesConcluidasHoje = artes?.filter((a: Arte) => a.status === 'DONE' && a.updatedAt.slice(0, 10) === todayLocal).length ?? 0;

  // Artes em andamento (DOING) para a seção
  const artesDoingList = artes?.filter((a: Arte) => a.status === 'DOING' || a.status === 'REVIEW') ?? [];

  // Stats cards config
  const statsCards = [
    ...(isAdmin ? [{
      label: 'Funcionários no trabalho hoje',
      value: funcionariosTrabalhando,
      bg: 'var(--blue)',
    }] : []),
    {
      label: 'Artes em andamento',
      value: artesEmAndamento,
      bg: 'var(--yellow)',
    },
    {
      label: 'Artes urgentes',
      value: artesUrgentes.length,
      bg: 'var(--red)',
    },
    {
      label: 'Aguardando revisão',
      value: artesReview,
      bg: 'var(--accent)',
    },
    {
      label: 'Concluídas hoje',
      value: artesConcluidasHoje,
      bg: 'var(--green)',
    },
  ];

  return (
    <>
      <Topbar title={`${greeting()}, ${user?.name?.split(' ')[0]}!`} />

      <div className="page-wrapper p-7 flex flex-col gap-6">
        {/* Stat cards */}
        <div className={`stat-grid grid gap-4 ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {statsCards.map((stat) => (
            <div
              key={stat.label}
              className="stat-card"
              style={{ background: stat.bg }}
            >
              <p className="stat-label-sm">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Duas colunas: Pontos Hoje + Artes em Andamento */}
        <div className="two-col-grid grid gap-5 lg-grid-cols-2">
          {/* PONTOS HOJE */}
          <Card>
            <div className="p-6 pb-2">
              <h3 className="section-title">
                ⏱ Pontos Hoje
              </h3>
            </div>
            <CardContent className="pt-0">
              {pontosHoje.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted">
                  <Clock size={60} className="mb-2 opacity-30" />
                  <p className="text-xs">Nenhum registro hoje.</p>
                </div>
              ) : (
                <div className="space-y-0" style={{ gap: 10, display: 'flex', flexDirection: 'column' }}>
                  {pontosHoje.map((ponto) => {
                    const entradaFmt = ponto.entrada ? format(new Date(ponto.entrada), 'HH:mm') : '--:--';
                    const saidaFmt = ponto.saida ? format(new Date(ponto.saida), 'HH:mm') : 'em curso';

                    // Status dot
                    let dotColor = 'var(--text3)';
                    if (ponto.saida) dotColor = 'var(--green)';
                    else if (ponto.retorno) dotColor = 'var(--green)';
                    else if (ponto.almoco) dotColor = 'var(--yellow)';
                    else if (ponto.entrada) dotColor = 'var(--blue)';

                    return (
                      <div
                        key={ponto.id}
                        className="flex items-center gap-3 rounded-lg py-3 px-4 dash-row-border"
                      >
                        <div
                          className="bg-dynamic flex h-10 w-10 items-center justify-center rounded-full text-12 font-bold text-white shrink-0"
                          data-color={ponto.user.avatarColor}
                        >
                          {ponto.user.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block font-medium dash-name">
                            {ponto.user.name}
                          </span>
                          <span className="block dash-mono-detail">
                            {entradaFmt} → {saidaFmt}
                          </span>
                        </div>
                        <span
                          className="inline-block h-2-5 w-2-5 rounded-full shrink-0"
                          style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ARTES EM ANDAMENTO */}
          <Card>
            <div className="p-6 pb-2">
              <h3 className="section-title">
                🎨 Artes em Andamento
              </h3>
            </div>
            <CardContent className="pt-0">
              {artesDoingList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted">
                  <Palette size={28} className="mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma arte em produção.</p>
                </div>
              ) : (
                <div className="space-y-0" style={{ gap: 10, display: 'flex', flexDirection: 'column' }}>
                  {artesDoingList.slice(0, 6).map((arte) => {
                    const urgencyColor =
                      arte.urgencia === 'HIGH' ? 'var(--red)' : arte.urgencia === 'NORMAL' ? 'var(--yellow)' : 'var(--green)';
                    const statusColor = arte.status === 'DOING' ? 'var(--blue)' : 'var(--yellow)';

                    return (
                      <div
                        key={arte.id}
                        className="flex items-center gap-3 rounded-lg py-3 px-4 dash-row-border"
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ background: statusColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium dash-name">
                              {arte.clienteNome}
                            </span>
                            <span className="dash-mono-detail">
                              — {PRODUTO_LABELS[arte.produto] ?? arte.produto}
                              {arte.quantidade > 1 ? ` (${arte.quantidade})` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0-5">
                            <span className="dash-mono-accent">
                              {arte.codigo}
                            </span>
                            <span className="dash-detail-sm">
                              · {arte.responsavel.name}
                            </span>
                          </div>
                        </div>
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
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
