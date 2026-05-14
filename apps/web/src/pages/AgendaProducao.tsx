import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Clock3, FolderKanban, AlertTriangle } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useArtes } from '@/hooks/useArtes';
import { useUsers } from '@/hooks/useUsers';
import { useNavigate } from 'react-router-dom';
import type { ArteStatus, Loja } from '@/types';
import { LOJA_LABELS, LOJA_OPTIONS } from '@/utils/lojas';
import { PRODUTO_LABELS, STATUS_LABELS, URGENCIA_LABELS, getStatusPeso, getUrgenciaPeso, isArteAtiva, isArteAtrasada } from '@/utils/arteAnalytics';

export function AgendaProducaoPage() {
  const { data: artes } = useArtes();
  const { data: users } = useUsers();
  const navigate = useNavigate();

  const hoje = startOfDay(new Date());
  const [filterLoja, setFilterLoja] = useState<'all' | Loja>('all');
  const [filterResponsavel, setFilterResponsavel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ArteStatus>('all');
  const [windowStart, setWindowStart] = useState(hoje);
  const [windowDays, setWindowDays] = useState<7 | 14>(7);
  const [selectedDateKey, setSelectedDateKey] = useState(format(hoje, 'yyyy-MM-dd'));

  useEffect(() => {
    setSelectedDateKey(format(windowStart, 'yyyy-MM-dd'));
  }, [windowStart, windowDays]);

  const activeUsers = useMemo(() => (users ?? []).filter((user) => user.active), [users]);
  const usuariosFiltrados = useMemo(
    () => activeUsers.filter((user) => filterLoja === 'all' || user.loja === filterLoja),
    [activeUsers, filterLoja],
  );

  const artesAtivas = useMemo(() => (artes ?? []).filter(isArteAtiva), [artes]);

  const agendaOrdenada = useMemo(() => {
    return artesAtivas
      .filter((arte) => filterLoja === 'all' || arte.responsavel.loja === filterLoja)
      .filter((arte) => filterResponsavel === 'all' || arte.responsavelId === filterResponsavel)
      .filter((arte) => filterStatus === 'all' || arte.status === filterStatus)
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
  }, [artesAtivas, filterLoja, filterResponsavel, filterStatus]);

  const resumo = useMemo(() => {
    const vencendoHoje = artesAtivas.filter((arte) => arte.prazo && isSameDay(new Date(arte.prazo), hoje)).length;
    const atrasadas = artesAtivas.filter((arte) => isArteAtrasada(arte, hoje)).length;
    const urgentes = artesAtivas.filter((arte) => arte.urgencia === 'HIGH').length;
    const semPrazo = artesAtivas.filter((arte) => !arte.prazo).length;

    return { vencendoHoje, atrasadas, urgentes, semPrazo };
  }, [artesAtivas, hoje]);

  const janela = useMemo(() => {
    return Array.from({ length: windowDays }, (_, index) => {
      const data = addDays(windowStart, index);
      const itens = agendaOrdenada.filter((arte) => arte.prazo && isSameDay(new Date(arte.prazo), data));
      return { data, dateKey: format(data, 'yyyy-MM-dd'), itens };
    });
  }, [agendaOrdenada, windowStart, windowDays]);

  const diaSelecionado = janela.find((dia) => dia.dateKey === selectedDateKey) ?? janela[0] ?? null;

  const cargaPorResponsavel = useMemo(() => {
    return usuariosFiltrados
      .map((user) => {
        const atribuicoes = agendaOrdenada.filter((arte) => arte.responsavelId === user.id);
        const urgentes = atribuicoes.filter((arte) => arte.urgencia === 'HIGH').length;
        const revisao = atribuicoes.filter((arte) => arte.status === 'REVIEW').length;
        const vencendoSemana = atribuicoes.filter((arte) => arte.prazo && differenceInCalendarDays(new Date(arte.prazo), windowStart) >= 0 && differenceInCalendarDays(new Date(arte.prazo), addDays(windowStart, windowDays - 1)) <= 0).length;

        return {
          id: user.id,
          nome: user.name,
          initials: user.initials,
          avatarColor: user.avatarColor,
          loja: user.loja,
          total: atribuicoes.length,
          urgentes,
          revisao,
          vencendoSemana,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || b.urgentes - a.urgentes || b.revisao - a.revisao);
  }, [agendaOrdenada, usuariosFiltrados, windowStart, windowDays]);

  const resumoInteligenteJanela = useMemo(() => {
    const urgentesNaJanela = janela.reduce((total, dia) => total + dia.itens.filter((arte) => arte.urgencia === 'HIGH').length, 0);
    const proximaEntrega = agendaOrdenada.find((arte) => arte.prazo);
    const responsavelMaisCarregado = cargaPorResponsavel[0] ?? null;

    return [
      {
        id: 'dia-selecionado',
        titulo: 'Dia selecionado',
        descricao: diaSelecionado
          ? `${diaSelecionado.itens.length} item(ns) programados, com ${diaSelecionado.itens.filter((arte) => arte.urgencia === 'HIGH').length} urgência(s).`
          : 'Nenhum dia ativo na janela.',
        action: 'Ver artes',
        onClick: () => navigate('/artes'),
        glow: 'accent' as const,
      },
      {
        id: 'proxima-entrega',
        titulo: 'Próxima entrega',
        descricao: proximaEntrega
          ? `${proximaEntrega.codigo} · ${proximaEntrega.clienteNome} com prazo em ${format(new Date(proximaEntrega.prazo!), 'dd/MM')}.`
          : 'Nenhuma entrega com prazo definida na janela atual.',
        action: 'Abrir agenda',
        onClick: () => setSelectedDateKey(janela[0]?.dateKey ?? format(hoje, 'yyyy-MM-dd')),
        glow: 'blue' as const,
      },
      {
        id: 'carga-lider',
        titulo: 'Carga líder',
        descricao: responsavelMaisCarregado
          ? `${responsavelMaisCarregado.nome} concentra ${responsavelMaisCarregado.total} arte(s), sendo ${urgentesNaJanela} urgência(s) na janela.`
          : 'Ainda não há distribuição operacional suficiente para leitura inteligente.',
        action: 'Ver operação',
        onClick: () => navigate('/gestao-operacional'),
        glow: 'green' as const,
      },
    ];
  }, [agendaOrdenada, cargaPorResponsavel, diaSelecionado, janela, hoje, navigate]);

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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Filtros da agenda</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2" style={{ padding: 4, borderRadius: 999, background: 'var(--bg3)', border: '1px solid var(--border2)' }}>
                  <Button variant={windowDays === 7 ? 'default' : 'ghost'} size="sm" onClick={() => setWindowDays(7)}>
                    7 dias
                  </Button>
                  <Button variant={windowDays === 14 ? 'default' : 'ghost'} size="sm" onClick={() => setWindowDays(14)}>
                    14 dias
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setWindowStart((current) => addDays(current, -7))}>
                  <ChevronLeft size={14} />
                  Voltar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWindowStart(hoje)}>
                  Hoje
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWindowStart((current) => addDays(current, 7))}>
                  Avançar
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <Select value={filterLoja} onValueChange={(value) => setFilterLoja(value as 'all' | Loja)}>
              <SelectTrigger className="mobile-select" style={{ width: '100%', maxWidth: 220 }}>
                <SelectValue placeholder="Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as lojas</SelectItem>
                {LOJA_OPTIONS.map((loja) => (
                  <SelectItem key={loja.value} value={loja.value}>{loja.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
              <SelectTrigger className="mobile-select" style={{ width: '100%', maxWidth: 240 }}>
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {usuariosFiltrados.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | ArteStatus)}>
              <SelectTrigger className="mobile-select" style={{ width: '100%', maxWidth: 220 }}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="TODO">A Fazer</SelectItem>
                <SelectItem value="DOING">Produção</SelectItem>
                <SelectItem value="REVIEW">Revisão</SelectItem>
                <SelectItem value="DONE">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo inteligente da janela</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="smart-summary-grid">
              {resumoInteligenteJanela.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="smart-summary-card interactive-card"
                  data-glow={item.glow}
                  onClick={item.onClick}
                  style={{ textAlign: 'left' }}
                >
                  <div className="smart-summary-title">{item.titulo}</div>
                  <div className="smart-summary-text">{item.descricao}</div>
                  <div style={{ marginTop: 10, color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>
                    {item.action} →
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle>
                    Janela de {format(windowStart, 'dd/MM', { locale: ptBR })} a {format(addDays(windowStart, windowDays - 1), 'dd/MM', { locale: ptBR })}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/artes')}>Abrir quadro de artes</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="agenda-window-grid">
                  {janela.map((dia) => {
                    const urgentes = dia.itens.filter((arte) => arte.urgencia === 'HIGH').length;
                    const ativo = dia.dateKey === selectedDateKey;
                    return (
                      <button
                        key={dia.dateKey}
                        onClick={() => setSelectedDateKey(dia.dateKey)}
                        className={`agenda-day-card interactive-card${ativo ? ' agenda-day-card-active' : ''}`}
                        data-glow="accent"
                      >
                        <div className="agenda-day-name">{format(dia.data, 'EEEE', { locale: ptBR })}</div>
                        <div className="agenda-day-date">{format(dia.data, 'dd/MM')}</div>
                        <div className="agenda-day-meta">
                          <div className="agenda-day-count">{dia.itens.length} item(ns)</div>
                          <div className={`agenda-day-urgent${urgentes > 0 ? ' agenda-day-urgent-highlight' : ''}`}>{urgentes} urgentes</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {diaSelecionado ? `Dia selecionado · ${format(diaSelecionado.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}` : 'Dia selecionado'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!diaSelecionado || diaSelecionado.itens.length === 0 ? (
                  <div style={{ color: 'var(--text2)', fontSize: 16 }}>Nenhuma produção programada para o dia selecionado.</div>
                ) : (
                  diaSelecionado.itens.map((arte) => {
                    const dias = arte.prazo ? differenceInCalendarDays(new Date(arte.prazo), hoje) : null;
                    return (
                      <div key={arte.id} className="agenda-item-card flex items-center justify-between gap-3 flex-wrap" style={{ padding: 16, borderRadius: 14 }}>
                        <div>
                          <div className="agenda-item-title">{arte.codigo} · {arte.clienteNome}</div>
                          <div className="agenda-item-sub" style={{ fontSize: 15, marginTop: 6 }}>
                            {PRODUTO_LABELS[arte.produto]} · {arte.responsavel.name} · {LOJA_LABELS[arte.responsavel.loja]}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={arte.urgencia === 'HIGH' ? 'danger' : arte.urgencia === 'NORMAL' ? 'warning' : 'info'}>{URGENCIA_LABELS[arte.urgencia]}</Badge>
                          <Badge variant={arte.status === 'REVIEW' ? 'warning' : 'outline'}>{STATUS_LABELS[arte.status]}</Badge>
                          <span className="agenda-item-emphasis" style={{ fontSize: 14 }}>
                            {dias === null ? 'Sem prazo' : dias < 0 ? `${Math.abs(dias)} dia(s) atrasada` : dias === 0 ? 'Entrega hoje' : `Faltam ${dias} dia(s)`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Fila priorizada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {agendaOrdenada.slice(0, 8).map((arte) => (
                  <div key={arte.id} className="agenda-priority-card" style={{ padding: 14, borderRadius: 14 }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <strong className="agenda-priority-title">{arte.codigo}</strong>
                      <Badge variant={arte.urgencia === 'HIGH' ? 'danger' : arte.urgencia === 'NORMAL' ? 'warning' : 'info'}>{URGENCIA_LABELS[arte.urgencia]}</Badge>
                    </div>
                    <div className="agenda-priority-title" style={{ fontSize: 18 }}>{arte.clienteNome}</div>
                    <div className="agenda-priority-sub" style={{ fontSize: 15, marginTop: 6 }}>{PRODUTO_LABELS[arte.produto]} · {arte.responsavel.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10, color: 'var(--text2)', fontSize: 14, fontWeight: 600 }}>
                      <span>{arte.prazo ? format(new Date(arte.prazo), 'dd/MM') : 'Sem prazo'}</span>
                      <span>{LOJA_LABELS[arte.responsavel.loja]}</span>
                    </div>
                  </div>
                ))}
                {agendaOrdenada.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 16 }}>Nenhuma arte ativa no momento.</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carga por responsável</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cargaPorResponsavel.map((item) => (
                  <div key={item.id} className="agenda-load-card flex items-center justify-between gap-3" style={{ padding: 14, borderRadius: 14 }}>
                    <div className="flex items-center gap-3">
                      <div className="bg-dynamic flex h-9 w-9 items-center justify-center rounded-full text-10 font-bold text-white" data-color={item.avatarColor}>
                        {item.initials}
                      </div>
                      <div>
                        <div className="agenda-item-title" style={{ fontSize: 18 }}>{item.nome}</div>
                        <div className="agenda-item-sub" style={{ fontSize: 14, marginTop: 4 }}>{LOJA_LABELS[item.loja]} · {item.total} arte(s)</div>
                      </div>
                    </div>
                    <div className="text-right" style={{ fontSize: 14 }}>
                      <div className="agenda-item-emphasis">{item.vencendoSemana} vencem na janela</div>
                      <div style={{ color: item.urgentes > 0 ? 'var(--red)' : 'var(--text2)', fontWeight: 600, marginTop: 4 }}>{item.urgentes} urgentes · {item.revisao} em revisão</div>
                    </div>
                  </div>
                ))}
                {cargaPorResponsavel.length === 0 && <div style={{ color: 'var(--text2)', fontSize: 16 }}>Sem carga operacional distribuída.</div>}
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
