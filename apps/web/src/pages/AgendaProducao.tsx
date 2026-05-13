import { useMemo } from 'react';
import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, AlertTriangle, Clock3, FolderKanban, ArrowRight } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useArtes } from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import { useNavigate } from 'react-router-dom';
import { PRODUTO_LABELS, STATUS_LABELS, URGENCIA_LABELS, getStatusPeso, getUrgenciaPeso, isArteAtiva, isArteAtrasada } from '@/utils/arteAnalytics';

export function AgendaProducaoPage() {
  const { data: artes } = useArtes();
  const { data: users } = useUsers();
  const navigate = useNavigate();

  const hoje = startOfDay(new Date());
  const artesAtivas = useMemo(() => (artes ?? []).filter(isArteAtiva), [artes]);

  const agendaOrdenada = useMemo(() => {
    return [...artesAtivas]
      .sort((a, b) => {
        const prazoA = a.prazo ? new Date(a.prazo).getTime() : Number.MAX_SAFE_INTEGER;
        const prazoB = b.prazo ? new Date(b.prazo).getTime() : Number.MAX_SAFE_INTEGER;
        return (
          prazoA - prazoB
          || getUrgenciaPeso(b.urgencia) - getUrgenciaPeso(a.urgencia)
          || getStatusPeso(b.status) - getStatusPeso(a.status)
          || a.clienteNome.localeCompare(b.clienteNome)
        );
      });
  }, [artesAtivas]);

  const resumo = useMemo(() => {
    const vencendoHoje = artesAtivas.filter((arte) => arte.prazo && isSameDay(new Date(arte.prazo), hoje)).length;
    const atrasadas = artesAtivas.filter((arte) => isArteAtrasada(arte, hoje)).length;
    const urgentes = artesAtivas.filter((arte) => arte.urgencia === 'HIGH').length;
    const semPrazo = artesAtivas.filter((arte) => !arte.prazo).length;

    return { vencendoHoje, atrasadas, urgentes, semPrazo };
  }, [artesAtivas, hoje]);

  const semana = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const data = addDays(hoje, index);
      const itens = agendaOrdenada.filter((arte) => arte.prazo && isSameDay(new Date(arte.prazo), data));
      return { data, itens };
    });
  }, [agendaOrdenada, hoje]);

  const cargaPorResponsavel = useMemo(() => {
    const activeUsers = (users ?? []).filter((user) => user.active);
    return activeUsers
      .map((user) => {
        const atribuicoes = artesAtivas.filter((arte) => arte.responsavelId === user.id);
        const urgentes = atribuicoes.filter((arte) => arte.urgencia === 'HIGH').length;
        const revisao = atribuicoes.filter((arte) => arte.status === 'REVIEW').length;
        const vencendoSemana = atribuicoes.filter((arte) => arte.prazo && differenceInCalendarDays(new Date(arte.prazo), hoje) >= 0 && differenceInCalendarDays(new Date(arte.prazo), hoje) <= 6).length;

        return {
          id: user.id,
          nome: user.name,
          initials: user.initials,
          avatarColor: user.avatarColor,
          total: atribuicoes.length,
          urgentes,
          revisao,
          vencendoSemana,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || b.urgentes - a.urgentes || b.revisao - a.revisao);
  }, [artesAtivas, hoje, users]);

  return (
    <>
      <Topbar title="Agenda de Produção" />
      <div className="page-wrapper p-7 flex flex-col gap-6">
        <div className="dash-stats-grid">
          <div className="dash-stat-card dash-stat-red">
            <div className="dash-stat-icon-wrap dash-stat-icon-red"><AlertTriangle size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.atrasadas}</span>
              <span className="dash-stat-label">Atrasadas</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow"><Clock3 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.vencendoHoje}</span>
              <span className="dash-stat-label">Vencem hoje</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><CalendarClock size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.urgentes}</span>
              <span className="dash-stat-label">Urgentes</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><FolderKanban size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.semPrazo}</span>
              <span className="dash-stat-label">Sem prazo</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)' }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle>Janela dos próximos 7 dias</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/artes')}>Abrir quadro de artes</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {semana.map((dia) => (
                <div key={dia.data.toISOString()} style={{ border: '1px solid var(--border2)', borderRadius: 12, padding: 14, background: 'var(--bg2)' }}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div style={{ fontWeight: 700 }}>{format(dia.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 12 }}>{dia.itens.length} item(ns) com prazo</div>
                    </div>
                    <Badge variant={dia.itens.length > 0 ? 'warning' : 'info'}>{dia.itens.length > 0 ? 'Carga planejada' : 'Livre'}</Badge>
                  </div>
                  {dia.itens.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum prazo cadastrado para este dia.</div>
                  ) : (
                    <div className="space-y-2">
                      {dia.itens.map((arte) => {
                        const dias = arte.prazo ? differenceInCalendarDays(new Date(arte.prazo), hoje) : null;
                        return (
                          <div key={arte.id} className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: 12, borderRadius: 10, background: 'var(--bg3)' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{arte.codigo} · {arte.clienteNome}</div>
                              <div style={{ color: 'var(--text2)', fontSize: 13 }}>
                                {PRODUTO_LABELS[arte.produto]} · {arte.responsavel.name} · {STATUS_LABELS[arte.status]}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={arte.urgencia === 'HIGH' ? 'danger' : arte.urgencia === 'NORMAL' ? 'warning' : 'info'}>{URGENCIA_LABELS[arte.urgencia]}</Badge>
                              <Badge variant={arte.status === 'REVIEW' ? 'warning' : 'outline'}>{STATUS_LABELS[arte.status]}</Badge>
                              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                                {dias === null ? 'Sem prazo' : dias < 0 ? `${Math.abs(dias)} dia(s) atrasada` : dias === 0 ? 'Entrega hoje' : `Faltam ${dias} dia(s)`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Fila priorizada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {agendaOrdenada.slice(0, 8).map((arte) => (
                  <div key={arte.id} style={{ padding: 12, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <strong>{arte.codigo}</strong>
                      <Badge variant={arte.urgencia === 'HIGH' ? 'danger' : arte.urgencia === 'NORMAL' ? 'warning' : 'info'}>{URGENCIA_LABELS[arte.urgencia]}</Badge>
                    </div>
                    <div style={{ fontWeight: 600 }}>{arte.clienteNome}</div>
                    <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>{PRODUTO_LABELS[arte.produto]} · {arte.responsavel.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, color: 'var(--text3)', fontSize: 12 }}>
                      <span>{arte.prazo ? format(new Date(arte.prazo), 'dd/MM') : 'Sem prazo'}</span>
                      <span>{STATUS_LABELS[arte.status]}</span>
                    </div>
                  </div>
                ))}
                {agendaOrdenada.length === 0 && <div style={{ color: 'var(--text3)' }}>Nenhuma arte ativa no momento.</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carga por responsável</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cargaPorResponsavel.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3" style={{ padding: 12, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                    <div className="flex items-center gap-3">
                      <div className="bg-dynamic flex h-9 w-9 items-center justify-center rounded-full text-10 font-bold text-white" data-color={item.avatarColor}>
                        {item.initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.nome}</div>
                        <div style={{ color: 'var(--text3)', fontSize: 12 }}>{item.total} arte(s) ativas</div>
                      </div>
                    </div>
                    <div className="text-right" style={{ fontSize: 12 }}>
                      <div>{item.vencendoSemana} vencem na semana</div>
                      <div style={{ color: item.urgentes > 0 ? 'var(--red)' : 'var(--text3)' }}>{item.urgentes} urgentes · {item.revisao} em revisão</div>
                    </div>
                  </div>
                ))}
                {cargaPorResponsavel.length === 0 && <div style={{ color: 'var(--text3)' }}>Sem carga operacional distribuída.</div>}
                <Button variant="outline" size="sm" onClick={() => navigate('/gestao-operacional')}>
                  Ver gestão operacional
                  <ArrowRight size={14} />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
