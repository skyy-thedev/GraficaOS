import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowUpRight, BadgeCheck, Building2, CalendarDays, CheckCircle2, Clock3, Fingerprint, ShieldCheck, UserRound } from 'lucide-react';
import { API_BASE } from '@/services/api';
import type { ComprovanteValidacao, Loja, PontoStatus } from '@/types';
import { formatarHora, parseDateOnly } from '@/utils/timezone';

function formatarLoja(loja: Loja): string {
  if (loja === 'PAPER_OFFICE_I') return 'PaperOffice I';
  if (loja === 'PAPER_OFFICE_II') return 'PaperOffice II';
  return 'Não informada';
}

function formatarStatus(status: PontoStatus): string {
  if (status === 'FOLGA') return 'Folga';
  if (status === 'FALTA') return 'Falta';
  return 'Normal';
}

function getStatusClasse(status: PontoStatus): string {
  if (status === 'FOLGA') return 'is-folga';
  if (status === 'FALTA') return 'is-falta';
  return 'is-normal';
}

function formatarRegistro(valor: string | null) {
  return valor ? formatarHora(valor) : '—';
}

const REGISTROS = [
  { chave: 'entrada', label: 'Entrada' },
  { chave: 'almoco', label: 'Saída almoço' },
  { chave: 'retorno', label: 'Retorno' },
  { chave: 'saida', label: 'Saída' },
] as const;

export function ValidarComprovantePage() {
  const { token } = useParams<{ token: string }>();
  const [comprovante, setComprovante] = useState<ComprovanteValidacao | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage('Token do comprovante não informado.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const carregarComprovante = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await axios.get<ComprovanteValidacao>(
          `${API_BASE}/api/pontos/comprovante/${encodeURIComponent(token)}`
        );

        if (isMounted) {
          setComprovante(response.data);
        }
      } catch (error) {
        if (!isMounted) return;

        if (axios.isAxiosError(error)) {
          setErrorMessage(error.response?.data?.message ?? 'Não foi possível validar este comprovante.');
        } else {
          setErrorMessage('Não foi possível validar este comprovante.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void carregarComprovante();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const dataFormatada = useMemo(() => {
    if (!comprovante) return '';
    const data = parseDateOnly(comprovante.expediente.data).toJSDate();
    return format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [comprovante]);

  const verificadoEmFormatado = useMemo(() => {
    if (!comprovante) return '';
    return format(new Date(comprovante.verificadoEm), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  }, [comprovante]);

  return (
    <div className="comprovante-page">
      <div className="comprovante-shell">
        <div className="comprovante-brand">
          <ShieldCheck size={18} />
          GraficaOS • Validação pública de comprovante
        </div>

        {isLoading ? (
          <div className="comprovante-card comprovante-state-card">
            <div className="comprovante-loading-dot" />
            <h1>Validando comprovante...</h1>
            <p>Estamos conferindo a assinatura digital e os dados do expediente.</p>
          </div>
        ) : errorMessage || !comprovante ? (
          <div className="comprovante-card comprovante-state-card is-error">
            <AlertTriangle size={42} />
            <h1>Comprovante inválido</h1>
            <p>{errorMessage ?? 'Não foi possível validar o comprovante informado.'}</p>
            <Link to="/login" className="comprovante-link-btn">
              Voltar para o sistema
            </Link>
          </div>
        ) : (
          <>
            <div className="comprovante-card comprovante-hero-card">
              <div className="comprovante-hero-copy">
                <span className="comprovante-badge comprovante-badge-success">
                  <CheckCircle2 size={16} />
                  Autenticidade confirmada
                </span>
                <h1>Comprovante validado com assinatura pública</h1>
                <p>
                  Este documento corresponde ao expediente de{' '}
                  <strong>{comprovante.funcionario.nome}</strong> em{' '}
                  <strong>{dataFormatada}</strong>.
                </p>
                <div className="comprovante-highlight-row">
                  <div className="comprovante-highlight-pill">
                    <Clock3 size={15} />
                    {comprovante.expediente.horasTrabalhadas ?? 'Sem total calculado'}
                  </div>
                  <div className={`comprovante-highlight-pill comprovante-highlight-status ${getStatusClasse(comprovante.expediente.status)}`}>
                    <BadgeCheck size={15} />
                    Status {formatarStatus(comprovante.expediente.status)}
                  </div>
                </div>
              </div>

              <div className="comprovante-hero-meta comprovante-hero-panel">
                <div>
                  <span>Verificado em</span>
                  <strong>{verificadoEmFormatado}</strong>
                </div>
                <div>
                  <span>Código do comprovante</span>
                  <strong>{comprovante.pontoId}</strong>
                </div>
                <div>
                  <span>Validação</span>
                  <strong>Pública e autenticada</strong>
                </div>
              </div>
            </div>

            <div className="comprovante-grid">
              <div className="comprovante-card">
                <div className="comprovante-section-title">
                  <UserRound size={18} />
                  Funcionário
                </div>
                <div className="comprovante-info-list">
                  <div>
                    <span>Nome</span>
                    <strong>{comprovante.funcionario.nome}</strong>
                  </div>
                  <div>
                    <span>Loja</span>
                    <strong>{formatarLoja(comprovante.funcionario.loja)}</strong>
                  </div>
                  <div>
                    <span>ID</span>
                    <strong>{comprovante.funcionario.id}</strong>
                  </div>
                </div>
              </div>

              <div className="comprovante-card">
                <div className="comprovante-section-title">
                  <CalendarDays size={18} />
                  Expediente
                </div>
                <div className="comprovante-info-list">
                  <div>
                    <span>Data</span>
                    <strong>{dataFormatada}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{formatarStatus(comprovante.expediente.status)}</strong>
                  </div>
                  <div>
                    <span>Total trabalhado</span>
                    <strong>{comprovante.expediente.horasTrabalhadas ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Encerramento automático</span>
                    <strong>{comprovante.expediente.encerramentoAutomatico ? 'Sim' : 'Não'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="comprovante-card">
              <div className="comprovante-section-title">
                <Clock3 size={18} />
                Marcações do dia
              </div>
              <div className="comprovante-timeline-grid">
                {REGISTROS.map((registro) => (
                  <div key={registro.chave} className="comprovante-timeline-item">
                    <span>{registro.label}</span>
                    <strong>{formatarRegistro(comprovante.registros[registro.chave])}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="comprovante-card comprovante-footer-card">
              <div>
                <div className="comprovante-section-title">
                  <Building2 size={18} />
                  Segurança da validação
                </div>
                <p>
                  O link deste comprovante foi assinado digitalmente e validado em ambiente público do GraficaOS.
                </p>
                <div className="comprovante-security-grid">
                  <div className="comprovante-security-item">
                    <ShieldCheck size={16} />
                    Assinatura ligada ao registro original
                  </div>
                  <div className="comprovante-security-item">
                    <Fingerprint size={16} />
                    Identidade do funcionário conferida
                  </div>
                </div>
              </div>
              <a href={comprovante.urlValidacao} className="comprovante-link-btn">
                <ArrowUpRight size={16} />
                Abrir URL canônica
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}