import { Topbar } from '@/components/layout/Topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRelatorio } from '@/hooks/usePonto';
import { useUsers } from '@/hooks/useUsers';
import { Download, Clock, ClipboardList, CheckCircle, Users as UsersIcon, UserX } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import type { Ponto } from '@/types';

// ===== Helpers =====
function calcularHoras(ponto: Ponto): string | null {
  if (!ponto.entrada || !ponto.saida) return null;
  let totalMs = new Date(ponto.saida).getTime() - new Date(ponto.entrada).getTime();
  if (ponto.almoco && ponto.retorno) {
    totalMs -= new Date(ponto.retorno).getTime() - new Date(ponto.almoco).getTime();
  }
  const totalMinutes = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}m`;
}

function getStatusLabel(p: Ponto): { label: string; color: string; dimColor: string } {
  if (p.saida) return { label: 'Completo', color: 'var(--green)', dimColor: 'var(--green-dim)' };
  if (p.retorno) return { label: 'Trabalhando', color: 'var(--blue)', dimColor: 'var(--blue-dim)' };
  if (p.almoco) return { label: 'Almoço', color: 'var(--yellow)', dimColor: 'var(--yellow-dim)' };
  if (p.entrada) return { label: 'Trabalhando', color: 'var(--blue)', dimColor: 'var(--blue-dim)' };
  return { label: 'Ausente', color: 'var(--red)', dimColor: 'var(--red-dim)' };
}

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return format(new Date(dateStr), 'HH:mm');
}

function exportCSV(pontos: Ponto[]) {
  const header = 'Funcionário,Cargo,Data,Entrada,Almoço,Retorno,Saída,Horas,Status\n';
  const rows = pontos.map((p) => {
    const status = getStatusLabel(p);
    const horas = calcularHoras(p) ?? '—';
    return `"${p.user.name}","Funcionário","${format(new Date(p.date), 'dd/MM/yyyy')}","${fmtTime(p.entrada)}","${fmtTime(p.almoco)}","${fmtTime(p.retorno)}","${fmtTime(p.saida)}","${horas}","${status.label}"`;
  });
  const csv = header + rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gestao-pontos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GestaoPontosPage() {
  const { data: users } = useUsers();
  const activeUsers = users?.filter((u) => u.active) ?? [];

  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterUserId, setFilterUserId] = useState<string>('all');

  const { data: relatorioPontos, isLoading } = useRelatorio({
    startDate: filterDate,
    endDate: filterDate,
    userId: filterUserId !== 'all' ? filterUserId : undefined,
  });

  // Stats
  const totalRegistros = relatorioPontos?.length ?? 0;
  const completosCount = relatorioPontos?.filter((p) => !!p.saida).length ?? 0;
  const trabalhandoCount = relatorioPontos?.filter((p) => p.entrada && !p.saida).length ?? 0;
  const totalFuncionarios = activeUsers.length;
  const ausentesCount = totalFuncionarios - totalRegistros;

  return (
    <>
      <Topbar title="Gestão de Pontos" />

      <div className="page-wrapper p-7 flex flex-col gap-6">
        {/* Stat cards */}
        
        <div className="dash-stats-grid">
          <div className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon-wrap dash-stat-icon-purple"><ClipboardList size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{totalRegistros}</span>
              <span className="dash-stat-label">Registros</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon-wrap dash-stat-icon-green"><CheckCircle size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{completosCount}</span>
              <span className="dash-stat-label">Completos</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon-wrap dash-stat-icon-blue"><UsersIcon size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{trabalhandoCount}</span>
              <span className="dash-stat-label">Trabalhando</span>
            </div>
          </div>
          <div className="dash-stat-card dash-stat-red">
            <div className="dash-stat-icon-wrap dash-stat-icon-red"><UserX size={18} /></div>
            <div className="dash-stat-info">
              <span className="dash-stat-number">{ausentesCount > 0 ? ausentesCount : 0}</span>
              <span className="dash-stat-label">Ausentes</span>
            </div>
          </div>
        </div>

        {/* Filtros + Exportar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle
                className="text-sm section-title"
              >
                RELATÓRIO DE PONTOS
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => relatorioPontos && exportCSV(relatorioPontos)}
                disabled={!relatorioPontos || relatorioPontos.length === 0}
              >
                <Download size={14} />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ width: 180 }}
              />
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger style={{ width: 220 }}>
                  <SelectValue placeholder="Todos os funcionários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funcionários</SelectItem>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabela */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-12 w-full" />
                ))}
              </div>
            ) : !relatorioPontos || relatorioPontos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
                <Clock size={36} className="mb-2 opacity-30" />
                <p className="text-sm">Nenhum registro encontrado para este filtro.</p>
              </div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className="w-full text-left table-text">
                  <thead>
                    <tr className="table-header-row">
                      {['FUNCIONÁRIO', 'DATA', 'ENTRADA', 'ALMOÇO', 'RETORNO', 'SAÍDA', 'HORAS', 'STATUS'].map((h) => (
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
                    {relatorioPontos.map((p) => {
                      const horas = calcularHoras(p);
                      const status = getStatusLabel(p);

                      return (
                        <tr key={p.id} className="table-body-row">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="bg-dynamic flex h-8 w-8 items-center justify-center rounded-full text-10 font-bold text-white shrink-0"
                                data-color={p.user.avatarColor}
                              >
                                {p.user.initials}
                              </div>
                              <div>
                                <span className="block text-21 font-medium dash-name">{p.user.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-secondary text-20">
                            {format(new Date(p.date), 'dd/MM/yyyy')}
                          </td>
                          <td className="py-3 px-4">
                            <TimeTag value={p.entrada} color="var(--green)" dimColor="var(--green-dim)" />
                          </td>
                          <td className="py-3 px-4">
                            <TimeTag value={p.almoco} color="var(--yellow)" dimColor="var(--yellow-dim)" />
                          </td>
                          <td className="py-3 px-4">
                            <TimeTag value={p.retorno} color="var(--blue)" dimColor="var(--blue-dim)" />
                          </td>
                          <td className="py-3 px-4">
                            <TimeTag value={p.saida} color="var(--red)" dimColor="var(--red-dim)" />
                          </td>
                          <td className="py-3 px-4 font-mono text-accent font-semibold text-20">
                            {horas ?? '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="inline-block px-2-5 py-1 rounded-full text-18 font-semibold font-mono tracking-wide"
                              style={{
                                background: status.dimColor,
                                color: status.color,
                                border: `1px solid ${status.color}`,
                              }}
                            >
                              {status.label}
                            </span>
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
    </>
  );
}

// Tag de horário reutilizável
function TimeTag({ value, color, dimColor }: { value: string | null; color: string; dimColor: string }) {
  if (!value) {
    return <span className="timetag-empty text-20">—</span>;
  }
  return (
    <span
      className="inline-block px-2 py-0-5 rounded text-19 timetag-filled"
      style={{ background: dimColor, color }}
    >
      {format(new Date(value), 'HH:mm')}
    </span>
  );
}
