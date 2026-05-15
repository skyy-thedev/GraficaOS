import { useMemo } from 'react';
import { format, startOfMonth, startOfToday } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarDays, Clock3, DollarSign, FileSpreadsheet, ReceiptText, Users } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { usePontoMetricas, useRelatorio } from '@/hooks/usePonto';
import { useVendas } from '@/hooks/useVendas';
import type { FormaPagamento } from '@/types';

type ReportPreset = 'day' | 'week' | 'month';

const PAYMENT_LABELS: Record<FormaPagamento, string> = {
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
  OUTRO: 'Outro',
};

function resolveRange(preset: ReportPreset) {
  const now = new Date();

  if (preset === 'day') {
    const today = startOfToday();
    return { startDate: format(today, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
  }

  if (preset === 'week') {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    return { startDate: format(monday, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
  }

  return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function RelatorioPage() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const preset = (searchParams.get('preset') as ReportPreset | null) ?? 'day';
  const focus = searchParams.get('focus') ?? 'sales';
  const range = resolveRange(preset);
  const { data: vendas } = useVendas();
  const { data: pontos } = useRelatorio({ startDate: range.startDate, endDate: range.endDate });
  const { data: metricas } = usePontoMetricas({ startDate: range.startDate, endDate: range.endDate });

  const visibleVendas = useMemo(
    () => (vendas ?? []).filter((venda) => isAdmin || venda.responsavelId === user?.id),
    [isAdmin, user?.id, vendas],
  );

  const vendasPeriodo = useMemo(
    () => visibleVendas.filter((venda) => {
      const date = (venda.createdAt ?? '').slice(0, 10);
      return date >= range.startDate && date <= range.endDate;
    }),
    [range.endDate, range.startDate, visibleVendas],
  );

  const concluidas = vendasPeriodo.filter((venda) => venda.status === 'CONCLUIDA');
  const aguardando = vendasPeriodo.filter((venda) => venda.status === 'AGUARDANDO');
  const totalVendido = concluidas.reduce((sum, venda) => sum + venda.valorTotal, 0);
  const ticketMedio = concluidas.length > 0 ? totalVendido / concluidas.length : 0;

  const paymentBreakdown = Object.entries(
    concluidas.reduce<Record<string, number>>((acc, venda) => {
      const key = venda.formaPagamento ?? 'OUTRO';
      acc[key] = (acc[key] ?? 0) + venda.valorTotal;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const sellerBreakdown = Object.values(
    vendasPeriodo.reduce<Record<string, { name: string; total: number; quantidade: number }>>((acc, venda) => {
      const key = venda.responsavelId;
      const current = acc[key] ?? { name: venda.responsavel.name, total: 0, quantidade: 0 };
      current.total += venda.valorTotal;
      current.quantidade += 1;
      acc[key] = current;
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);

  return (
    <>
      <Topbar title="Relatório" />
      <div className="page-wrapper relatorio-page p-7 flex flex-col gap-6">
        <Card className="pricing-hero-card">
          <CardContent className="pt-6 pricing-hero-content">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="section-title">Relatório consolidado</h2>
                <Badge variant="info">Vendas + Pontos</Badge>
              </div>
              <p className="oper-filter-note" style={{ marginTop: 6 }}>
                Consolide vendas, presença e produtividade no mesmo período para decisões mais rápidas.
              </p>
            </div>
            <div className="pricing-hero-tags">
              <span><FileSpreadsheet size={14} /> período ativo: {range.startDate} até {range.endDate}</span>
              <span><BarChart3 size={14} /> foco atual: {focus === 'sales' ? 'vendas' : 'pontos'}</span>
            </div>
          </CardContent>
        </Card>

        <div className="report-filter-row">
          <Button variant={preset === 'day' ? 'default' : 'outline'} onClick={() => setSearchParams({ preset: 'day', focus })}>Hoje</Button>
          <Button variant={preset === 'week' ? 'default' : 'outline'} onClick={() => setSearchParams({ preset: 'week', focus })}>Semana</Button>
          <Button variant={preset === 'month' ? 'default' : 'outline'} onClick={() => setSearchParams({ preset: 'month', focus })}>Mês</Button>
        </div>

        <div className="dash-stats-grid report-stats-grid">
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><DollarSign size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{formatMoney(totalVendido)}</span>
              <span className="dash-stat-label">Total vendido</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><ReceiptText size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{concluidas.length}</span>
              <span className="dash-stat-label">Vendas concluídas</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-yellow">
            <div className="dash-stat-icon-wrap dash-stat-icon-yellow"><Clock3 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{aguardando.length}</span>
              <span className="dash-stat-label">Em orçamento</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><CalendarDays size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{formatMoney(ticketMedio)}</span>
              <span className="dash-stat-label">Ticket médio</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-teal">
            <div className="dash-stat-icon-wrap dash-stat-icon-teal"><Users size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{metricas?.diasTrabalhados ?? 0}</span>
              <span className="dash-stat-label">Dias trabalhados</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-red">
            <div className="dash-stat-icon-wrap dash-stat-icon-red"><BarChart3 size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{metricas?.percentualPresenca ?? 0}%</span>
              <span className="dash-stat-label">Presença</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 report-grid">
          <Card>
            <CardHeader>
              <CardTitle>Relatório de vendas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vendasPeriodo.length === 0 ? (
                <div className="oper-filter-note">Nenhuma venda encontrada no período selecionado.</div>
              ) : (
                vendasPeriodo.slice(0, 12).map((venda) => (
                  <div key={venda.id} className="venda-card">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="oper-card-title">{venda.codigo} · {venda.produtoNome}</div>
                        <div className="oper-card-sub" style={{ marginTop: 6 }}>{venda.clienteNome || 'Cliente balcão'} · {venda.quantidade} un.</div>
                        <div className="oper-card-sub" style={{ marginTop: 4 }}>Responsável: {venda.responsavel.name}</div>
                      </div>
                      <div className="venda-card-side">
                        <div className="venda-card-total">{formatMoney(venda.valorTotal)}</div>
                        <div className="venda-card-meta">{venda.status}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Relatório operacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="pricing-preview-details">
                <div>
                  <span>Total de dias</span>
                  <strong>{metricas?.totalDias ?? 0}</strong>
                </div>
                <div>
                  <span>Dias com falta</span>
                  <strong>{metricas?.diasFalta ?? 0}</strong>
                </div>
                <div>
                  <span>Horas trabalhadas</span>
                  <strong>{metricas?.totalHorasTrabalhadas ?? '00:00'}</strong>
                </div>
              </div>

              <div className="report-breakdown-list">
                <div>
                  <span className="pricing-preview-overline">Pagamentos</span>
                  <div className="space-y-2" style={{ marginTop: 10 }}>
                    {paymentBreakdown.length === 0 ? (
                      <div className="oper-filter-note">Sem pagamentos concluídos neste período.</div>
                    ) : paymentBreakdown.map(([payment, amount]) => (
                      <div key={payment} className="pricing-breakdown-row">
                        <span>{PAYMENT_LABELS[payment as FormaPagamento] ?? payment}</span>
                        <strong>{formatMoney(amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="pricing-preview-overline">Responsáveis</span>
                  <div className="space-y-2" style={{ marginTop: 10 }}>
                    {sellerBreakdown.length === 0 ? (
                      <div className="oper-filter-note">Sem vendas registradas por responsável neste período.</div>
                    ) : sellerBreakdown.map((seller) => (
                      <div key={seller.name} className="pricing-breakdown-row">
                        <span>{seller.name} · {seller.quantidade} venda(s)</span>
                        <strong>{formatMoney(seller.total)}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="pricing-preview-overline">Registros de ponto</span>
                  <div className="space-y-2" style={{ marginTop: 10 }}>
                    <div className="pricing-breakdown-row"><span>Batidas no período</span><strong>{pontos?.length ?? 0}</strong></div>
                    <div className="pricing-breakdown-row"><span>Pontualidade</span><strong>{metricas?.percentualPontualidade ?? 0}%</strong></div>
                    <div className="pricing-breakdown-row"><span>Encerramentos automáticos</span><strong>{metricas?.encerramentosAutomaticos ?? 0}</strong></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}