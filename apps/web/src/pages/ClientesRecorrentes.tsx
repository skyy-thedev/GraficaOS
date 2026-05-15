import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Repeat2, MessageCircle, Search, History } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useArtes } from '@/hooks/useArtes';
import { PRODUTO_LABELS, STATUS_LABELS, URGENCIA_LABELS, extrairNumeroContato, isArteAtiva, normalizarTexto } from '@/utils/arteAnalytics';

export function ClientesRecorrentesPage() {
  const { data: artes } = useArtes();
  const [busca, setBusca] = useState('');

  const clientes = useMemo(() => {
    const grupos = new Map<string, { nome: string; numero: string; artes: typeof artes }>();

    for (const arte of artes ?? []) {
      const chave = `${normalizarTexto(arte.clienteNome)}::${extrairNumeroContato(arte.clienteNumero) || arte.clienteNumero}`;
      const atual = grupos.get(chave);
      if (atual) {
        atual.artes?.push(arte);
      } else {
        grupos.set(chave, {
          nome: arte.clienteNome,
          numero: arte.clienteNumero,
          artes: [arte],
        });
      }
    }

    return Array.from(grupos.values())
      .map((cliente) => {
        const lista = [...(cliente.artes ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const abertas = lista.filter(isArteAtiva).length;
        const urgentes = lista.filter((arte) => arte.urgencia === 'HIGH' && arte.status !== 'DONE').length;
        const produtos = Array.from(new Set(lista.map((arte) => PRODUTO_LABELS[arte.produto]))).slice(0, 3);
        const combinacoes = new Map<string, number>();
        for (const arte of lista) {
          const chaveCombo = `${arte.produto}-${arte.larguraCm}-${arte.alturaCm}`;
          combinacoes.set(chaveCombo, (combinacoes.get(chaveCombo) ?? 0) + 1);
        }
        const reimpressoes = Array.from(combinacoes.values()).filter((total) => total > 1).length;

        return {
          id: `${normalizarTexto(cliente.nome)}-${extrairNumeroContato(cliente.numero)}`,
          nome: cliente.nome,
          numero: cliente.numero,
          totalArtes: lista.length,
          abertas,
          urgentes,
          reimpressoes,
          ultimaArte: lista[0] ?? null,
          produtos,
          historico: lista.slice(0, 5),
        };
      })
      .filter((cliente) => {
        const alvo = normalizarTexto(`${cliente.nome} ${cliente.numero}`);
        return alvo.includes(normalizarTexto(busca));
      })
      .sort((a, b) => b.totalArtes - a.totalArtes || b.abertas - a.abertas || a.nome.localeCompare(b.nome));
  }, [artes, busca]);

  const resumo = useMemo(() => {
    const recorrentes = clientes.filter((cliente) => cliente.totalArtes > 1).length;
    const comDemandaAberta = clientes.filter((cliente) => cliente.abertas > 0).length;
    const topCliente = clientes[0] ?? null;
    const potenciaisReimpressoes = clientes.reduce((soma, cliente) => soma + cliente.reimpressoes, 0);
    return { recorrentes, comDemandaAberta, topCliente, potenciaisReimpressoes };
  }, [clientes]);

  return (
    <>
      <Topbar title="Cliente Recorrente" />
      <div className="page-wrapper clientes-page p-7 flex flex-col gap-6">
        <div className="dash-stats-grid clientes-stats-grid">
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><Repeat2 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.recorrentes}</span>
              <span className="dash-stat-label">Clientes recorrentes</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><History size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.comDemandaAberta}</span>
              <span className="dash-stat-label">Com demanda aberta</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><MessageCircle size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.potenciaisReimpressoes}</span>
              <span className="dash-stat-label">Padrões de reimpressão</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow"><Search size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{resumo.topCliente?.totalArtes ?? 0}</span>
              <span className="dash-stat-label">Maior histórico</span>
            </div>
            <span className="dash-stat-sub">{resumo.topCliente?.nome ?? '—'}</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Relacionamento e histórico</CardTitle>
              <div style={{ width: 320, maxWidth: '100%' }}>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou número" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="clientes-history-grid">
            {clientes.map((cliente) => {
              const telefone = extrairNumeroContato(cliente.numero);
              return (
                <div key={cliente.id} className="cliente-history-card" style={{ border: '1px solid var(--border2)', borderRadius: 14, padding: 16, background: 'var(--bg2)' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{cliente.nome}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 13 }}>{cliente.numero}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={cliente.abertas > 0 ? 'warning' : 'info'}>{cliente.abertas} aberta(s)</Badge>
                      <Badge variant={cliente.urgentes > 0 ? 'danger' : 'outline'}>{cliente.urgentes} urgentes</Badge>
                      <Badge variant="outline">{cliente.totalArtes} artes</Badge>
                      {telefone && (
                        <Button size="sm" variant="ghost" onClick={() => window.open(`https://wa.me/${telefone}`, '_blank', 'noopener,noreferrer')}>
                          <MessageCircle size={14} />
                          WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))' }}>
                    <div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>Última atualização</div>
                      <div style={{ fontWeight: 700 }}>
                        {cliente.ultimaArte ? formatDistanceToNow(new Date(cliente.ultimaArte.updatedAt), { addSuffix: true, locale: ptBR }) : 'Sem histórico'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>Produtos mais frequentes</div>
                      <div style={{ fontWeight: 700 }}>{cliente.produtos.join(' · ') || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>Reimpressões potenciais</div>
                      <div style={{ fontWeight: 700 }}>{cliente.reimpressoes}</div>
                    </div>
                  </div>

                  <div className="cliente-history-list space-y-2 mt-4">
                    {cliente.historico.map((arte) => (
                      <div key={arte.id} className="cliente-history-item flex items-center justify-between gap-3 flex-wrap" style={{ padding: 12, borderRadius: 10, background: 'var(--bg3)' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{arte.codigo} · {PRODUTO_LABELS[arte.produto]}</div>
                          <div style={{ color: 'var(--text3)', fontSize: 12 }}>{arte.responsavel.name} · {arte.larguraCm}×{arte.alturaCm}cm</div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={arte.urgencia === 'HIGH' ? 'danger' : arte.urgencia === 'NORMAL' ? 'warning' : 'info'}>{URGENCIA_LABELS[arte.urgencia]}</Badge>
                          <Badge variant={arte.status === 'DONE' ? 'success' : 'outline'}>{STATUS_LABELS[arte.status]}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
            {clientes.length === 0 && <div style={{ color: 'var(--text3)' }}>Nenhum cliente encontrado com os filtros atuais.</div>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
