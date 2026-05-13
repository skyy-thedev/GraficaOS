import { useMemo } from 'react';
import { differenceInCalendarDays, subDays } from 'date-fns';
import { Activity, AlertTriangle, CheckCircle2, RefreshCcw, TimerReset } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useArtes } from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import { STATUS_LABELS, URGENCIA_LABELS, isArteAtiva } from '@/utils/arteAnalytics';

export function GestaoOperacionalPage() {
  const { data: artes } = useArtes();
  const { data: users } = useUsers();

  const inicioJanela = subDays(new Date(), 30);
  const artesLista = artes ?? [];
  const artesAtivas = artesLista.filter(isArteAtiva);
  const concluidasRecentes = artesLista.filter((arte) => arte.status === 'DONE' && new Date(arte.updatedAt) >= inicioJanela);

  const tempoMedioDias = useMemo(() => {
    if (concluidasRecentes.length === 0) return 0;
    const total = concluidasRecentes.reduce((soma, arte) => soma + Math.max(0, differenceInCalendarDays(new Date(arte.updatedAt), new Date(arte.createdAt))), 0);
    return Math.round((total / concluidasRecentes.length) * 10) / 10;
  }, [concluidasRecentes]);

  const rankingResponsaveis = useMemo(() => {
    return (users ?? [])
      .filter((user) => user.active)
      .map((user) => {
        const atribuicoes = artesLista.filter((arte) => arte.responsavelId === user.id);
        const ativas = atribuicoes.filter(isArteAtiva);
        const concluidas = atribuicoes.filter((arte) => arte.status === 'DONE' && new Date(arte.updatedAt) >= inicioJanela);
        const urgenciasResolvidas = concluidas.filter((arte) => arte.urgencia === 'HIGH').length;
        const retrabalhos = atribuicoes.filter((arte) => arte.status === 'REVIEW').length;
        const tempoMedio = concluidas.length > 0
          ? Math.round((concluidas.reduce((soma, arte) => soma + Math.max(0, differenceInCalendarDays(new Date(arte.updatedAt), new Date(arte.createdAt))), 0) / concluidas.length) * 10) / 10
          : 0;

        return {
          id: user.id,
          nome: user.name,
          initials: user.initials,
          avatarColor: user.avatarColor,
          volumeAtivo: ativas.length,
          concluidas: concluidas.length,
          urgenciasResolvidas,
          retrabalhos,
          tempoMedio,
          score: concluidas.length * 12 + urgenciasResolvidas * 6 - retrabalhos * 4 - ativas.length,
        };
      })
      .filter((item) => item.volumeAtivo > 0 || item.concluidas > 0)
      .sort((a, b) => b.score - a.score || b.concluidas - a.concluidas || a.retrabalhos - b.retrabalhos);
  }, [artesLista, inicioJanela, users]);

  const gargalos = useMemo(() => {
    return [
      {
        id: 'review',
        titulo: 'Fila em revisão',
        valor: artesAtivas.filter((arte) => arte.status === 'REVIEW').length,
        detalhe: 'Peças aguardando validação final.',
        variante: 'warning' as const,
      },
      {
        id: 'urgente',
        titulo: 'Urgências abertas',
        valor: artesAtivas.filter((arte) => arte.urgencia === 'HIGH').length,
        detalhe: 'Demandas que pedem prioridade imediata.',
        variante: 'danger' as const,
      },
      {
        id: 'sem-prazo',
        titulo: 'Sem prazo definido',
        valor: artesAtivas.filter((arte) => !arte.prazo).length,
        detalhe: 'Itens sem data para encaixe operacional.',
        variante: 'info' as const,
      },
    ];
  }, [artesAtivas]);

  return (
    <>
      <Topbar title="Gestão Operacional" />
      <div className="page-wrapper p-7 flex flex-col gap-6">
        <div className="dash-stats-grid">
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><Activity size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesAtivas.length}</span>
              <span className="dash-stat-label">Em operação</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><CheckCircle2 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{concluidasRecentes.length}</span>
              <span className="dash-stat-label">Entregues em 30 dias</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow"><TimerReset size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{tempoMedioDias}</span>
              <span className="dash-stat-label">Tempo médio por arte</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-red">
            <div className="dash-stat-icon-wrap dash-stat-icon-red"><RefreshCcw size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{artesAtivas.filter((arte) => arte.status === 'REVIEW').length}</span>
              <span className="dash-stat-label">Retrabalho em revisão</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)' }}>
          <Card>
            <CardHeader>
              <CardTitle>Ranking operacional por responsável</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankingResponsaveis.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between gap-4 flex-wrap" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg2)' }}>
                  <div className="flex items-center gap-3">
                    <div className="bg-dynamic flex h-10 w-10 items-center justify-center rounded-full text-10 font-bold text-white" data-color={item.avatarColor}>
                      {item.initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>#{index + 1} · {item.nome}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12 }}>{item.volumeAtivo} em aberto · {item.concluidas} concluídas</div>
                    </div>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(80px, 1fr))', minWidth: 320 }}>
                    <div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>Urgências</div>
                      <div style={{ fontWeight: 700 }}>{item.urgenciasResolvidas}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>Retrabalho</div>
                      <div style={{ fontWeight: 700, color: item.retrabalhos > 0 ? 'var(--yellow)' : 'var(--text1)' }}>{item.retrabalhos}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>Tempo médio</div>
                      <div style={{ fontWeight: 700 }}>{item.tempoMedio || '—'} {item.tempoMedio ? 'dias' : ''}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>Score</div>
                      <div style={{ fontWeight: 700 }}>{item.score}</div>
                    </div>
                  </div>
                </div>
              ))}
              {rankingResponsaveis.length === 0 && <div style={{ color: 'var(--text3)' }}>Ainda não há histórico suficiente para comparar responsáveis.</div>}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Gargalos imediatos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gargalos.map((gargalo) => (
                  <div key={gargalo.id} style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg2)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <strong>{gargalo.titulo}</strong>
                      <Badge variant={gargalo.variante}>{gargalo.valor}</Badge>
                    </div>
                    <div style={{ color: 'var(--text3)', fontSize: 13 }}>{gargalo.detalhe}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(['TODO', 'DOING', 'REVIEW', 'DONE'] as const).map((status) => {
                  const total = artesLista.filter((arte) => arte.status === status).length;
                  return (
                    <div key={status} className="flex items-center justify-between gap-3" style={{ paddingBottom: 8, borderBottom: '1px solid var(--border2)' }}>
                      <span>{STATUS_LABELS[status]}</span>
                      <strong>{total}</strong>
                    </div>
                  );
                })}
                <div style={{ paddingTop: 4, color: 'var(--text3)', fontSize: 12 }}>
                  Urgências abertas: {artesAtivas.filter((arte) => arte.urgencia === 'HIGH').length} · {URGENCIA_LABELS.HIGH}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pontos de atenção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {artesAtivas
                  .filter((arte) => arte.urgencia === 'HIGH' || arte.status === 'REVIEW')
                  .slice(0, 6)
                  .map((arte) => (
                    <div key={arte.id} style={{ padding: 12, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <strong>{arte.codigo}</strong>
                        <Badge variant={arte.urgencia === 'HIGH' ? 'danger' : 'warning'}>{arte.urgencia === 'HIGH' ? 'Urgente' : 'Revisão'}</Badge>
                      </div>
                      <div style={{ marginTop: 6 }}>{arte.clienteNome}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>{arte.responsavel.name} · {STATUS_LABELS[arte.status]}</div>
                    </div>
                  ))}
                {artesAtivas.length === 0 && <div style={{ color: 'var(--text3)' }}>Sem pontos críticos no momento.</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
