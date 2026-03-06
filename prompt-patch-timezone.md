# PROMPT — GráficaOS · PATCH CRÍTICO: Timezone + Melhorias no Relatório
> Cole este prompt no chat do GitHub Copilot (Claude Opus) no VS Code.
> **PRIORIDADE MÁXIMA** — Bug crítico afetando integridade dos dados de ponto.

---

## 🚨 CONTEXTO DO BUG CRÍTICO

O sistema está com **dois problemas graves de timezone** que comprometem a integridade dos dados:

### Problema 1: Conversão UTC ↔ America/Sao_Paulo inconsistente
- **Servidor Prisma**: US East (N. Virginia) — UTC-5
- **Usuário**: Horário de Brasília (São Paulo) — UTC-3
- **Sintoma**: Pontos sendo salvos com horários errados (diferença de 3h), causando inconsistências como `01:13` e `22:13` no mesmo registro
- **Evidência anexa**: PDF mostra `13/02/2026 01:13` quando deveria ser `12/02/2026 22:13`

### Problema 2: Data sendo registrada como dia anterior
- **Sintoma**: Quando funcionário bate ponto hoje (05/03), sistema registra como 04/03
- **Causa raiz**: Conversão de timezone aplicada na data, não apenas no horário

### Impacto
- ❌ Relatórios com datas e horas incorretas
- ❌ Exportações (CSV/Excel/PDF) com dados inválidos
- ❌ Cálculo de horas trabalhadas comprometido
- ❌ Métricas de streak e frequência incorretas
- ❌ Perda de confiança no sistema

---

## PARTE 1 — CORREÇÃO CRÍTICA DE TIMEZONE

### 1A — Estratégia de Correção

**Princípio fundamental:** 
- Armazenar tudo em **UTC no banco** (padrão internacional)
- Converter para **America/Sao_Paulo** apenas na apresentação (frontend + relatórios)
- Garantir que a **data** seja sempre relativa ao timezone do usuário, não do servidor

### 1B — Backend: Configurar Timezone do Prisma

No `apps/api/src/index.ts`, adicionar **no topo do arquivo**:

```typescript
// Forçar timezone do processo Node para UTC (padrão internacional)
process.env.TZ = 'UTC'

// Importar biblioteca de timezone
import { DateTime } from 'luxon'

// Configurar timezone padrão da aplicação
const TIMEZONE_BRASIL = 'America/Sao_Paulo'
```

Instalar dependência:
```bash
npm install luxon --workspace apps/api
npm install -D @types/luxon --workspace apps/api
```

### 1C — Utilitário de Conversão de Timezone

Criar `apps/api/src/utils/timezone.ts`:

```typescript
import { DateTime } from 'luxon'

const TIMEZONE = 'America/Sao_Paulo'

/**
 * Converte Date do JavaScript (sempre em UTC internamente) para DateTime do Luxon
 * no timezone de São Paulo
 */
export function toSaoPaulo(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(TIMEZONE)
}

/**
 * Obtém a data atual (só a data, sem hora) no timezone de São Paulo
 * Retorna como Date em UTC mas representando o dia correto em SP
 * 
 * Exemplo: Se em SP é 05/03/2024 02:00 (ainda 04/03 23:00 em UTC)
 * → Retorna Date representando 05/03/2024 00:00:00 UTC
 */
export function getHojeEmSaoPaulo(): Date {
  const agoraEmSP = DateTime.now().setZone(TIMEZONE)
  
  // Criar data em UTC que representa o dia atual em SP
  return DateTime.utc(
    agoraEmSP.year,
    agoraEmSP.month,
    agoraEmSP.day,
    0, 0, 0, 0
  ).toJSDate()
}

/**
 * Obtém o DateTime exato atual em São Paulo (com hora)
 */
export function getAgoraEmSaoPaulo(): DateTime {
  return DateTime.now().setZone(TIMEZONE)
}

/**
 * Formata DateTime para string no formato brasileiro
 */
export function formatarDataBR(date: Date | DateTime): string {
  const dt = date instanceof Date ? toSaoPaulo(date) : date
  return dt.toFormat('dd/MM/yyyy')
}

export function formatarHoraBR(date: Date | DateTime): string {
  const dt = date instanceof Date ? toSaoPaulo(date) : date
  return dt.toFormat('HH:mm')
}

export function formatarDataHoraBR(date: Date | DateTime): string {
  const dt = date instanceof Date ? toSaoPaulo(date) : date
  return dt.toFormat('dd/MM/yyyy HH:mm')
}

/**
 * Calcula diferença em horas e minutos entre dois horários
 * Retorna string no formato "Xh Ym"
 */
export function calcularDiferencaHoras(inicio: Date, fim: Date): string {
  const dtInicio = toSaoPaulo(inicio)
  const dtFim = toSaoPaulo(fim)
  
  const diff = dtFim.diff(dtInicio, ['hours', 'minutes'])
  const horas = Math.floor(diff.hours)
  const minutos = Math.round(diff.minutes % 60)
  
  return `${horas}h${String(minutos).padStart(2, '0')}m`
}
```

### 1D — Corrigir Controller de Ponto (`apps/api/src/controllers/pontoController.ts`)

**No endpoint `GET /api/pontos/hoje`:**

```typescript
import { getHojeEmSaoPaulo, getAgoraEmSaoPaulo, toSaoPaulo } from '../utils/timezone'

export async function getPontoHoje(req: Request, res: Response) {
  const userId = req.user!.id
  
  // CRÍTICO: Usar data de hoje em São Paulo, não UTC
  const hoje = getHojeEmSaoPaulo()
  
  const ponto = await prisma.ponto.findUnique({
    where: {
      userId_date: {
        userId,
        date: hoje, // ← FIX: agora usa data correta em SP
      },
    },
  })
  
  // Se não existe, retornar estrutura vazia mas com data correta
  if (!ponto) {
    return res.json({
      date: hoje,
      entrada: null,
      almoco: null,
      retorno: null,
      saida: null,
    })
  }
  
  return res.json(ponto)
}
```

**No endpoint `POST /api/pontos/bater`:**

```typescript
export async function baterPonto(req: Request, res: Response) {
  const userId = req.user!.id
  
  // CRÍTICO: Usar data e hora de São Paulo
  const hoje = getHojeEmSaoPaulo()
  const agora = getAgoraEmSaoPaulo().toJSDate() // converte para Date em UTC
  
  // Buscar ou criar ponto de hoje
  let ponto = await prisma.ponto.findUnique({
    where: {
      userId_date: { userId, date: hoje },
    },
  })
  
  if (!ponto) {
    ponto = await prisma.ponto.create({
      data: {
        userId,
        date: hoje, // ← FIX: data correta em SP
        entrada: agora, // ← FIX: horário em UTC mas representando hora em SP
      },
      include: { user: true },
    })
    return res.json(ponto)
  }
  
  // Lógica de batida sequencial...
  if (!ponto.entrada) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { entrada: agora },
      include: { user: true },
    })
  } else if (!ponto.almoco) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { almoco: agora },
      include: { user: true },
    })
  } else if (!ponto.retorno) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { retorno: agora },
      include: { user: true },
    })
  } else if (!ponto.saida) {
    ponto = await prisma.ponto.update({
      where: { id: ponto.id },
      data: { saida: agora },
      include: { user: true },
    })
  } else {
    return res.status(400).json({ error: 'Jornada do dia já encerrada' })
  }
  
  return res.json(ponto)
}
```

**No endpoint `GET /api/pontos/relatorio`:**

```typescript
import { formatarDataBR, formatarHoraBR, calcularDiferencaHoras } from '../utils/timezone'

export async function getRelatorio(req: Request, res: Response) {
  // ... buscar pontos do período ...
  
  // Formatar cada ponto com conversão correta
  const pontosFormatados = pontos.map(ponto => ({
    ...ponto,
    dataFormatada: formatarDataBR(ponto.date),
    entradaFormatada: ponto.entrada ? formatarHoraBR(ponto.entrada) : '—',
    almocoFormatada: ponto.almoco ? formatarHoraBR(ponto.almoco) : '—',
    retornoFormatada: ponto.retorno ? formatarHoraBR(ponto.retorno) : '—',
    saidaFormatada: ponto.saida ? formatarHoraBR(ponto.saida) : '—',
    horasTrabalhadas: calcularHorasTrabalhadas(ponto), // usar utilitário
  }))
  
  return res.json(pontosFormatados)
}

function calcularHorasTrabalhadas(ponto: Ponto): string {
  if (!ponto.entrada || !ponto.saida) return '—'
  
  const entrada = toSaoPaulo(ponto.entrada)
  const saida = toSaoPaulo(ponto.saida)
  
  let totalMinutos = saida.diff(entrada, 'minutes').minutes
  
  // Descontar intervalo de almoço se houver retorno
  if (ponto.almoco && ponto.retorno) {
    const almoco = toSaoPaulo(ponto.almoco)
    const retorno = toSaoPaulo(ponto.retorno)
    const intervaloMinutos = retorno.diff(almoco, 'minutes').minutes
    totalMinutos -= intervaloMinutos
  }
  
  const horas = Math.floor(totalMinutos / 60)
  const minutos = Math.round(totalMinutos % 60)
  
  return `${horas}h${String(minutos).padStart(2, '0')}m`
}
```

### 1E — Corrigir Job de Encerramento Automático

Em `apps/api/src/jobs/fecharPontos.ts`:

```typescript
import { getHojeEmSaoPaulo, getAgoraEmSaoPaulo } from '../utils/timezone'

export async function fecharPontosAbertos() {
  const hoje = getHojeEmSaoPaulo()
  const agoraEmSP = getAgoraEmSaoPaulo()
  
  // Criar DateTime para 22:00 de hoje em SP
  const horarioEncerramento = agoraEmSP.set({ hour: 22, minute: 0, second: 0 })
  
  const pontosAbertos = await prisma.ponto.findMany({
    where: {
      date: hoje, // ← FIX: buscar pelo dia correto em SP
      entrada: { not: null },
      saida: null,
    },
    include: { user: true },
  })
  
  if (pontosAbertos.length === 0) {
    console.log('✅ Nenhum ponto aberto para encerrar')
    return { encerrados: 0 }
  }
  
  // Atualizar com 22:00 em SP (convertido para UTC no banco)
  const resultado = await prisma.ponto.updateMany({
    where: {
      id: { in: pontosAbertos.map(p => p.id) },
    },
    data: {
      saida: horarioEncerramento.toJSDate(), // ← FIX: converte para UTC
      encerramentoAutomatico: true,
    },
  })
  
  console.log(`⏰ ${resultado.count} pontos encerrados às 22h (horário de Brasília)`)
  return { encerrados: resultado.count, usuarios: pontosAbertos.map(p => p.user) }
}
```

### 1F — Corrigir Exportações (PDF/Excel/CSV)

**PDF (`apps/api/src/controllers/exportController.ts`):**

```typescript
import { formatarDataBR, formatarHoraBR } from '../utils/timezone'

// No gerador de PDF:
pontos.forEach(ponto => {
  doc.text(formatarDataBR(ponto.date))       // ← FIX: formatar data
  doc.text(formatarHoraBR(ponto.entrada))    // ← FIX: formatar hora
  doc.text(formatarHoraBR(ponto.almoco))
  doc.text(formatarHoraBR(ponto.retorno))
  doc.text(formatarHoraBR(ponto.saida))
  doc.text(calcularHorasTrabalhadas(ponto))  // ← FIX: usar função corrigida
})
```

Mesma correção aplicar em **Excel** e **CSV**.

---

## PARTE 2 — FRONTEND: Garantir Consistência de Timezone

### 2A — Utilitário Frontend (`apps/web/src/utils/timezone.ts`)

```typescript
import { DateTime } from 'luxon'

const TIMEZONE = 'America/Sao_Paulo'

/**
 * Converte ISO string do backend para DateTime em SP
 */
export function parseDataHora(isoString: string): DateTime {
  return DateTime.fromISO(isoString, { zone: 'UTC' }).setZone(TIMEZONE)
}

/**
 * Formata data no padrão brasileiro
 */
export function formatarData(isoString: string): string {
  return parseDataHora(isoString).toFormat('dd/MM/yyyy')
}

export function formatarHora(isoString: string): string {
  return parseDataHora(isoString).toFormat('HH:mm')
}

export function formatarDataHora(isoString: string): string {
  return parseDataHora(isoString).toFormat('dd/MM/yyyy HH:mm')
}

/**
 * Obtém data/hora atual em SP para exibição de relógio
 */
export function getAgoraSP(): DateTime {
  return DateTime.now().setZone(TIMEZONE)
}
```

Instalar no frontend:
```bash
npm install luxon --workspace apps/web
npm install -D @types/luxon --workspace apps/web
```

### 2B — Corrigir Exibição de Horários nas Páginas

**Página de Ponto (`apps/web/src/pages/Ponto.tsx`):**

```tsx
import { formatarHora } from '@/utils/timezone'

// Ao exibir horários do ponto:
<span>{ponto.entrada ? formatarHora(ponto.entrada) : '—'}</span>
<span>{ponto.almoco ? formatarHora(ponto.almoco) : '—'}</span>
<span>{ponto.retorno ? formatarHora(ponto.retorno) : '—'}</span>
<span>{ponto.saida ? formatarHora(ponto.saida) : '—'}</span>
```

**Relógio em tempo real:**

```tsx
import { getAgoraSP } from '@/utils/timezone'

function Clock() {
  const [time, setTime] = useState(getAgoraSP())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getAgoraSP())
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
  return <div>{time.toFormat('HH:mm:ss')}</div>
}
```

Aplicar mesma correção em **Dashboard**, **Analytics**, **Checklist** e todas as páginas que exibem datas/horários.

---

## PARTE 3 — MELHORIAS ESTRATÉGICAS NO RELATÓRIO

### MELHORIA 1: Detecção Automática de Anomalias com Alertas Visuais

**Objetivo:** Identificar padrões suspeitos automaticamente e destacar no relatório.

#### Backend: Endpoint de Análise de Anomalias

```typescript
// GET /api/pontos/anomalias?startDate=X&endDate=Y&userId=Z

interface Anomalia {
  pontoId: string
  tipo: 'JORNADA_EXCESSIVA' | 'INTERVALO_CURTO' | 'ENTRADA_MUITO_CEDO' | 'SAIDA_MUITO_TARDE' | 'MULTIPLAS_BATIDAS_RAPIDAS'
  severidade: 'BAIXA' | 'MEDIA' | 'ALTA'
  descricao: string
  sugestao?: string
}

// Lógica de detecção:
// 1. Jornada > 12h → ALTA (possível erro de batida)
// 2. Intervalo de almoço < 30min → MEDIA (lei trabalhista)
// 3. Entrada antes das 05h → BAIXA (suspeito)
// 4. Saída após 23h → MEDIA (hora extra não autorizada?)
// 5. Múltiplas batidas em < 5min → ALTA (possível duplicação)
```

#### Frontend: Exibição de Alertas no Relatório

Na tabela de pontos, adicionar coluna "Alertas":

```tsx
{anomalias.length > 0 && (
  <div className="flex gap-1">
    {anomalias.map(a => (
      <Tooltip key={a.tipo} content={a.descricao}>
        <span className={`alert-badge ${a.severidade.toLowerCase()}`}>
          {a.severidade === 'ALTA' ? '🚨' : a.severidade === 'MEDIA' ? '⚠️' : 'ℹ️'}
        </span>
      </Tooltip>
    ))}
  </div>
)}
```

Estilos:
```css
.alert-badge.alta {
  background: var(--red-dim); color: var(--red);
  border: 1px solid var(--red);
  padding: 2px 6px; border-radius: 4px;
  font-size: 10px; cursor: help;
}
.alert-badge.media {
  background: var(--yellow-dim); color: var(--yellow);
  border: 1px solid var(--yellow);
}
.alert-badge.baixa {
  background: var(--blue-dim); color: var(--blue);
  border: 1px solid var(--blue);
}
```

**No PDF exportado:**
Adicionar seção ao final: "⚠️ Anomalias Detectadas" com lista de todas as anomalias encontradas no período.

---

### MELHORIA 2: Resumo Executivo com Insights Automáticos

**Objetivo:** Gerar automaticamente um resumo inteligente do período para o admin.

#### Backend: Endpoint de Insights

```typescript
// GET /api/pontos/insights?startDate=X&endDate=Y

interface InsightsPeriodo {
  periodo: { inicio: string, fim: string }
  
  destaques: {
    tipo: 'POSITIVO' | 'NEUTRO' | 'ATENCAO'
    titulo: string
    descricao: string
    metrica?: string
  }[]
  
  comparacao: {
    periodoAnterior: {
      presenca: number
      horasTotais: string
      pontualidade: number
    }
    variacao: {
      presenca: string  // "+5%" ou "-3%"
      horas: string
      pontualidade: string
    }
  }
  
  funcionarioDestaque: {
    melhorPresenca: { nome: string, percentual: number }
    melhorPontualidade: { nome: string, percentual: number }
    maisHoras: { nome: string, horas: string }
  }
  
  recomendacoes: string[]  // Sugestões automáticas baseadas nos dados
}

// Exemplos de destaques gerados automaticamente:
// - POSITIVO: "Melhor mês de pontualidade em 6 meses (92%)"
// - ATENCAO: "3 funcionários com mais de 2 encerramentos automáticos"
// - NEUTRO: "Média de horas estável em relação ao mês anterior"

// Exemplos de recomendações:
// - "Considere revisar com Carlos os 4 encerramentos automáticos em fevereiro"
// - "Júlia teve 100% de presença. Considere reconhecimento formal."
// - "Intervalo médio de almoço está abaixo de 45min. Verificar se está adequado."
```

#### Frontend: Card de Insights no Dashboard Analytics

Adicionar card expansível no topo da página Analytics:

```tsx
<div className="insights-card">
  <div className="insights-header">
    <h3>💡 Resumo Inteligente do Período</h3>
    <button onClick={toggleExpand}>{expanded ? '▼' : '▶'}</button>
  </div>
  
  {expanded && (
    <div className="insights-body">
      <div className="destaques-grid">
        {insights.destaques.map(d => (
          <div className={`destaque ${d.tipo.toLowerCase()}`}>
            <span className="destaque-icon">
              {d.tipo === 'POSITIVO' ? '✅' : d.tipo === 'ATENCAO' ? '⚠️' : 'ℹ️'}
            </span>
            <div>
              <strong>{d.titulo}</strong>
              <p>{d.descricao}</p>
              {d.metrica && <span className="metrica">{d.metrica}</span>}
            </div>
          </div>
        ))}
      </div>
      
      <div className="comparacao">
        <h4>📊 Comparação com Período Anterior</h4>
        <div className="metricas-comparacao">
          <div>Presença: {insights.comparacao.variacao.presenca}</div>
          <div>Horas: {insights.comparacao.variacao.horas}</div>
          <div>Pontualidade: {insights.comparacao.variacao.pontualidade}</div>
        </div>
      </div>
      
      {insights.recomendacoes.length > 0 && (
        <div className="recomendacoes">
          <h4>💡 Recomendações</h4>
          <ul>
            {insights.recomendacoes.map(r => <li>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )}
</div>
```

**No PDF exportado:**
Incluir página inicial com "Resumo Executivo" antes da tabela detalhada.

---

## PARTE 4 — TESTES E VALIDAÇÃO

### 4A — Checklist de Validação Manual

Após implementar as correções, testar:

- [ ] Bater ponto às 22:30 → deve registrar no dia ATUAL, não no anterior
- [ ] Bater ponto às 00:30 → deve registrar no dia ATUAL (já passou meia-noite em SP)
- [ ] Exportar PDF de fevereiro → datas e horas devem estar corretas (comparar com evidência atual)
- [ ] Job de encerramento → simular mudando cron para `* * * * *` (todo minuto) e verificar log
- [ ] Relatório com período de 1 mês → todas as datas em sequência correta, sem saltos
- [ ] Calcular horas trabalhadas → verificar se descontou almoço corretamente
- [ ] Streak de funcionário → não pode quebrar por problema de data
- [ ] Timezone do navegador diferente → deve exibir sempre em horário de Brasília

### 4B — Testes Automatizados (Opcional mas Recomendado)

Criar `apps/api/src/tests/timezone.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getHojeEmSaoPaulo, getAgoraEmSaoPaulo, calcularDiferencaHoras } from '../utils/timezone'
import { DateTime } from 'luxon'

describe('Timezone Utils', () => {
  it('deve retornar data de hoje em SP mesmo se servidor em UTC diferente', () => {
    const hoje = getHojeEmSaoPaulo()
    const hojeEmSP = DateTime.now().setZone('America/Sao_Paulo').startOf('day')
    
    expect(hoje.getDate()).toBe(hojeEmSP.day)
    expect(hoje.getMonth() + 1).toBe(hojeEmSP.month)
    expect(hoje.getFullYear()).toBe(hojeEmSP.year)
  })
  
  it('deve calcular diferença de horas corretamente', () => {
    const entrada = new Date('2024-03-05T11:00:00Z')  // 08:00 em SP (UTC-3)
    const saida = new Date('2024-03-05T20:00:00Z')    // 17:00 em SP
    
    const diff = calcularDiferencaHoras(entrada, saida)
    expect(diff).toBe('9h00m')
  })
})
```

---

## ORDEM DE EXECUÇÃO

**CRÍTICO — siga esta ordem exata:**

1. **Backend — Instalar Luxon** → `npm install luxon @types/luxon --workspace apps/api`
2. **Backend — Criar utils/timezone.ts** → todas as funções de conversão
3. **Backend — Corrigir pontoController** → métodos `hoje`, `bater`, `relatorio`
4. **Backend — Corrigir job de encerramento** → usar funções de timezone
5. **Backend — Corrigir exportações** → PDF, Excel, CSV com formatação correta
6. **Teste Manual 1** → bater ponto e verificar data/hora no banco (usar Prisma Studio)
7. **Frontend — Instalar Luxon** → `npm install luxon @types/luxon --workspace apps/web`
8. **Frontend — Criar utils/timezone.ts** → formatadores
9. **Frontend — Corrigir todas as páginas** → Ponto, Dashboard, Analytics
10. **Teste Manual 2** → navegar pelo sistema e verificar todos os horários
11. **Backend — Implementar endpoint de anomalias** (Melhoria 1)
12. **Frontend — Adicionar alertas de anomalias** na tabela
13. **Backend — Implementar endpoint de insights** (Melhoria 2)
14. **Frontend — Adicionar card de insights** no Analytics
15. **Teste Final** → gerar PDF e comparar com evidência antiga — deve estar 100% correto

---

## EVIDÊNCIA DE SUCESSO

Após a correção, o mesmo relatório de fevereiro deve exibir:

**ANTES (incorreto):**
```
Carlos Eduardo Silva Jr | 13/02/2026 | 01:13 | 01:13 | 01:13 | 01:13 | 0h00m
```

**DEPOIS (correto):**
```
Carlos Eduardo Silva Jr | 12/02/2026 | 22:13 | 23:45 | 00:30 | 03:15 | 5h30m
```
*(exemplo hipotético — os valores reais dependem dos dados, mas data e horários devem estar consistentes)*

---

## REGRAS FINAIS

- **NUNCA** usar `new Date()` diretamente para obter "hoje" — sempre `getHojeEmSaoPaulo()`
- **NUNCA** usar `.toISOString()` para formatar data/hora para usuário — sempre funções de `timezone.ts`
- **SEMPRE** armazenar em UTC no Prisma (deixar o Prisma fazer isso automaticamente)
- **SEMPRE** converter para SP antes de exibir ou exportar
- TypeScript strict — nenhum `any`
- Após conclusão total: rodar `tsc --noEmit` em ambos workspaces, confirmar 0 erros
- Gerar PDF de teste e anexar evidência de que está correto

---

**Comece pela Etapa 1 — instale Luxon no backend e crie o arquivo utils/timezone.ts com todas as funções. Após criado, me mostre o conteúdo do arquivo para validação antes de avançar.**
