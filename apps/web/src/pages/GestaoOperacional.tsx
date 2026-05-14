import { useMemo, useState } from 'react';
import { differenceInCalendarDays, subDays } from 'date-fns';
import { Activity, AlertTriangle, CheckCircle2, RefreshCcw, TimerReset } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useArtes } from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import type { Loja } from '@/types';
import { LOJA_LABELS, LOJA_OPTIONS } from '@/utils/lojas';
import { STATUS_LABELS, URGENCIA_LABELS, isArteAtiva } from '@/utils/arteAnalytics';

export function GestaoOperacionalPage() {
  const { data: artes } = useArtes();
  const { data: users } = useUsers();
  const [filterLoja, setFilterLoja] = useState<'all' | Loja>('all');

  const inicioJanela = subDays(new Date(), 30);
  const artesLista = (artes ?? []).filter((arte) => filterLoja === 'all' || arte.responsavel.loja === filterLoja);
  const usuariosAtivos = (users ?? []).filter((user) => user.active && (filterLoja === 'all' || user.loja === filterLoja));
  const artesAtivas = artesLista.filter(isArteAtiva);
  const concluidasRecentes = artesLista.filter((arte) => arte.status === 'DONE' && new Date(arte.updatedAt) >= inicioJanela);

  const tempoMedioDias = useMemo(() => {
    if (concluidasRecentes.length === 0) return 0;
    const total = concluidasRecentes.reduce((soma, arte) => soma + Math.max(0, differenceInCalendarDays(new Date(arte.updatedAt), new Date(arte.createdAt))), 0);
    return Math.round((total / concluidasRecentes.length) * 10) / 10;
  }, [concluidasRecentes]);

  const rankingResponsaveis = useMemo(() => {
    return usuariosAtivos
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
          loja: user.loja,
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
  }, [artesLista, inicioJanela, usuariosAtivos]);

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
        <Card>
          <CardContent className="pt-6 flex items-center gap-3 flex-wrap">
            <Select value={filterLoja} onValueChange={(value) => setFilterLoja(value as 'all' | Loja)}>
              <SelectTrigger className="mobile-select" style={{ width: '100%', maxWidth: 240 }}>
                <SelectValue placeholder="Filtrar por loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {LOJA_OPTIONS.map((loja) => (
                  <SelectItem key={loja.value} value={loja.value}>{loja.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="oper-filter-note">
              {filterLoja === 'all' ? 'Visão consolidada das duas lojas.' : `Exibindo somente ${LOJA_LABELS[filterLoja]}.`}
            </div>
          </CardContent>
        </Card>

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

        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
          <Card>
            <CardHeader>
              <CardTitle>Ranking operacional por responsável</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankingResponsaveis.map((item, index) => (
                <div key={item.id} className="oper-card-strong flex items-center justify-between gap-4 flex-wrap" style={{ padding: 16, borderRadius: 14 }}>
                  <div className="flex items-center gap-3">
                    <div className="bg-dynamic flex h-10 w-10 items-center justify-center rounded-full text-10 font-bold text-white" data-color={item.avatarColor}>
                      {item.initials}
                    </div>
                    <div>
                      <div className="oper-card-title">#{index + 1} · {item.nome}</div>
                      <div className="oper-card-sub" style={{ fontSize: 14, marginTop: 4 }}>{LOJA_LABELS[item.loja]} · {item.volumeAtivo} em aberto · {item.concluidas} concluídas</div>
                    </div>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', width: '100%', maxWidth: 460 }}>
                    <div>
                      <div className="oper-card-sub" style={{ fontSize: 12 }}>Urgências</div>
                      <div className="oper-card-emphasis" style={{ fontSize: 22, marginTop: 4 }}>{item.urgenciasResolvidas}</div>
                    </div>
                    <div>
                      <div className="oper-card-sub" style={{ fontSize: 12 }}>Retrabalho</div>
                      <div style={{ fontWeight: 800, fontSize: 22, color: item.retrabalhos > 0 ? 'var(--yellow)' : 'var(--text)' }}>{item.retrabalhos}</div>
                    </div>
                    <div>
                      <div className="oper-card-sub" style={{ fontSize: 12 }}>Tempo médio</div>
                      <div className="oper-card-emphasis" style={{ fontSize: 22, marginTop: 4 }}>{item.tempoMedio || '—'} {item.tempoMedio ? 'dias' : ''}</div>
                    </div>
                    <div>
                      <div className="oper-card-sub" style={{ fontSize: 12 }}>Score</div>
                      <div className="oper-card-emphasis" style={{ fontSize: 22, marginTop: 4 }}>{item.score}</div>
                    </div>
                  </div>
                </div>
              ))}
              {rankingResponsaveis.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 16 }}>Ainda não há histórico suficiente para comparar responsáveis.</div>}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Gargalos imediatos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gargalos.map((gargalo) => (
                  <div key={gargalo.id} className="oper-card-strong" style={{ padding: 16, borderRadius: 14 }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <strong className="oper-card-title" style={{ fontSize: 18 }}>{gargalo.titulo}</strong>
                      <Badge variant={gargalo.variante}>{gargalo.valor}</Badge>
                    </div>
                    <div className="oper-card-sub" style={{ fontSize: 15 }}>{gargalo.detalhe}</div>
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
                <div style={{ paddingTop: 4, color: 'var(--text2)', fontSize: 14, fontWeight: 600 }}>
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
                    <div key={arte.id} className="oper-card-strong" style={{ padding: 14, borderRadius: 14 }}>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="oper-card-title" style={{ fontSize: 18 }}>{arte.codigo}</strong>
                        <Badge variant={arte.urgencia === 'HIGH' ? 'danger' : 'warning'}>{arte.urgencia === 'HIGH' ? 'Urgente' : 'Revisão'}</Badge>
                      </div>
                      <div className="oper-card-emphasis" style={{ marginTop: 8, fontSize: 18 }}>{arte.clienteNome}</div>
                      <div className="oper-card-sub" style={{ fontSize: 14, marginTop: 6 }}>{arte.responsavel.name} · {LOJA_LABELS[arte.responsavel.loja]} · {STATUS_LABELS[arte.status]}</div>
                    </div>
                  ))}
                {artesAtivas.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 16 }}>Sem pontos críticos no momento.</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
