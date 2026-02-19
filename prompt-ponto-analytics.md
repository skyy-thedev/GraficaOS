# PROMPT — GráficaOS · Aprimoramento do Módulo de Ponto
> Cole este prompt no chat do GitHub Copilot (Claude) no VS Code.
> Feature completa: dashboard analítico de ponto com exportações múltiplas, gráficos, filtros avançados, encerramento automático e gamificação.

---

## CONTEXTO

O módulo de ponto funciona, mas precisa de recursos profissionais de gestão e motivação. Esta sprint adiciona:

**Para o ADMIN:**
- Exportação em múltiplos formatos: CSV, PDF, Excel (.xlsx), Email automático
- Gráficos de frequência e horas trabalhadas por funcionário
- Filtros rápidos: Hoje, Semana, Mês, Semestre, Ano (além do range customizado)
- Dashboard analítico com métricas agregadas

**Para os FUNCIONÁRIOS:**
- Histórico motivacional com badges e métricas de desempenho
- Sequência de dias consecutivos sem falta (streak)
- Total de horas trabalhadas no mês com progressão visual
- Comparação visual com média da equipe

**Automação do Sistema:**
- Job que roda às 22h todo dia e encerra automaticamente pontos abertos (registra saída às 22:00)
- Notificação para admin sobre encerramentos automáticos

---

## PARTE 1 — BACKEND

### 1A — Novo campo no model Ponto (`schema.prisma`)

```prisma
model Ponto {
  // ... campos existentes ...
  encerramentoAutomatico Boolean @default(false)
  // Indica se a saída foi registrada automaticamente pelo sistema às 22h
}
```

Rodar migration:
```bash
npx prisma migrate dev --name add_encerramento_automatico
```

### 1B — Job de Encerramento Automático

Criar arquivo `apps/api/src/jobs/fecharPontos.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function fecharPontosAbertos() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  
  const agora = new Date()
  const horarioEncerramento = new Date()
  horarioEncerramento.setHours(22, 0, 0, 0)

  // Buscar pontos de hoje que têm entrada mas NÃO têm saída
  const pontosAbertos = await prisma.ponto.findMany({
    where: {
      date: hoje,
      entrada: { not: null },
      saida: null,
    },
    include: { user: true },
  })

  if (pontosAbertos.length === 0) {
    console.log('✅ Nenhum ponto aberto para encerrar')
    return { encerrados: 0 }
  }

  // Atualizar todos com saída = 22:00
  const resultado = await prisma.ponto.updateMany({
    where: {
      id: { in: pontosAbertos.map(p => p.id) },
    },
    data: {
      saida: horarioEncerramento,
      encerramentoAutomatico: true,
    },
  })

  console.log(`⏰ ${resultado.count} pontos encerrados automaticamente às 22h`)
  
  // Retornar lista de usuários afetados para notificação
  return {
    encerrados: resultado.count,
    usuarios: pontosAbertos.map(p => ({
      id: p.user.id,
      name: p.user.name,
      entrada: p.entrada,
    })),
  }
}
```

Configurar cron job no `apps/api/src/index.ts`:

```typescript
import cron from 'node-cron'
import { fecharPontosAbertos } from './jobs/fecharPontos'

// Roda todo dia às 22:00
cron.schedule('0 22 * * *', async () => {
  console.log('🕙 Iniciando job de encerramento automático de pontos...')
  await fecharPontosAbertos()
})
```

Adicionar dependência:
```bash
npm install node-cron @types/node-cron --workspace apps/api
```

### 1C — Novos endpoints de Exportação

```typescript
// apps/api/src/routes/pontos.ts

// GET /api/pontos/export/csv
// Query: startDate, endDate, userId? (mesmo do relatorio)
// Response: Content-Type: text/csv; filename: pontos-YYYY-MM-DD.csv

// GET /api/pontos/export/xlsx
// Query: mesmos
// Response: Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// Usar biblioteca: exceljs

// POST /api/pontos/export/pdf
// Body: { startDate, endDate, userId?, email? }
// Se email fornecido → gera PDF e envia por email, retorna { sent: true }
// Se não → retorna o PDF como blob
// Usar biblioteca: pdfkit

// POST /api/pontos/export/email
// Body: { startDate, endDate, userId?, destinatario: string }
// Gera PDF e envia via nodemailer
// Response: { sent: true, message: 'Relatório enviado para email@exemplo.com' }
```

### 1D — Endpoint de Métricas Agregadas

```typescript
// GET /api/pontos/metricas
// Query: startDate, endDate, userId? (se fornecido, métricas individuais; se não, agregadas da equipe)

interface MetricasPonto {
  periodo: { inicio: string, fim: string }
  
  // Métricas gerais
  totalDias: number
  diasTrabalhados: number
  diasFalta: number
  percentualPresenca: number  // 0-100
  
  // Horas
  totalHorasTrabalhadas: string  // "176h30m"
  mediaHorasPorDia: string       // "8h15m"
  
  // Pontualidade (entrada <= 08:15 considerado pontual — configurável)
  diasPontuais: number
  percentualPontualidade: number
  
  // Sequência atual de dias sem falta
  streakAtual: number
  maiorStreak: number
  
  // Encerramento automático
  encerramentosAutomaticos: number
  
  // Gráficos (arrays para plotar)
  horasPorDia: { data: string, horas: number }[]  // número decimal de horas
  frequenciaSemanal: { semana: string, presencas: number, total: number }[]
}
```

### 1E — Lógica de Cálculo do Streak

```typescript
// Calcular "dias consecutivos sem falta" até hoje
// Percorrer de hoje para trás, contando dias com entrada !== null
// Parar no primeiro dia sem entrada (falta)
// Exemplo: se hoje é dia 15 e teve entrada de 10 a 15 → streak = 6

function calcularStreak(pontos: Ponto[]): number {
  // pontos ordenados do mais recente ao mais antigo
  let streak = 0
  for (const ponto of pontos) {
    if (!ponto.entrada) break
    streak++
  }
  return streak
}
```

### 1F — Implementação das Exportações

**CSV:**
```typescript
// Formato:
// Data,Funcionário,Entrada,Almoço,Retorno,Saída,Horas Trabalhadas,Status,Enc.Auto
// 2024-12-15,Ana Silva,08:02,12:05,13:08,17:35,8h26m,Completo,Não
```

**Excel (.xlsx):**
```typescript
import ExcelJS from 'exceljs'

// Criar workbook com:
// - Sheet 1: Tabela de pontos (mesmo formato CSV mas com cores e bordas)
// - Sheet 2: Resumo por funcionário (total horas, faltas, pontualidade)
// - Aplicar estilos: header com background #6c63ff, texto branco
// - Células de horas com formatação numérica
// - Auto-width nas colunas
```

**PDF:**
```typescript
import PDFDocument from 'pdfkit'

// Layout:
// Header: Logo GráficaOS + título "Relatório de Pontos"
// Subtítulo: Período DD/MM/YYYY a DD/MM/YYYY
// Tabela de pontos (usar pdfkit-table ou montar manualmente)
// Footer: gerado em DD/MM/YYYY às HH:MM
// Paleta de cores do sistema (dark mode adaptado para impressão)
```

**Email:**
```typescript
import nodemailer from 'nodemailer'

// Configurar SMTP (variáveis de ambiente):
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

// Template HTML do email:
// - Header com logo
// - Texto: "Segue em anexo o relatório de pontos do período X a Y"
// - Anexar PDF
// - Footer com link para o sistema
```

### 1G — Variáveis de Ambiente

Adicionar ao `.env.example`:
```env
# Email (para exportação automática)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-app"
SMTP_FROM="GráficaOS <noreply@graficaos.com>"

# Horário considerado "pontual" (para métricas)
HORARIO_ENTRADA_PONTUAL="08:15"
```

---

## PARTE 2 — FRONTEND

### 2A — Nova biblioteca de gráficos

Instalar Recharts (React puro, leve, fácil de customizar com o design system):
```bash
npm install recharts --workspace apps/web
```

### 2B — Refatoração da Página de Ponto (Funcionário)

#### Seção de Métricas Motivacionais (novo — acima do relógio)

```
┌─────────────────────────────────────────────────────────────┐
│  🔥 Streak        📊 Horas no Mês       📈 Pontualidade     │
│  [12] dias        [142h30m / 176h]     [95%]                │
│  consecutivos     [barra progresso]    28 de 30 dias        │
└─────────────────────────────────────────────────────────────┘
```

**Card de Streak:**
```css
/* Container */
background: linear-gradient(135deg, var(--orange-dim), transparent);
border: 1px solid var(--border); border-radius: var(--radius-lg);
padding: 20px; position: relative; overflow: hidden;

/* Número do streak */
font-family: 'JetBrains Mono', monospace;
font-size: 48px; font-weight: 700; color: var(--orange);
text-shadow: 0 0 20px rgba(255, 157, 77, 0.3);

/* Label */
font-size: 12px; color: var(--text3); text-transform: uppercase;
letter-spacing: 0.5px; font-family: 'JetBrains Mono';

/* Badge de milestone */
/* Se streak >= 7 dias → badge "🔥 1 SEMANA" */
/* Se streak >= 30 dias → badge "🏆 1 MÊS" */
/* Se streak >= 90 dias → badge "💎 DIAMANTE" */
```

**Card de Horas no Mês:**
```tsx
// Buscar total esperado com base em dias úteis (pode ser ~176h para 22 dias úteis)
// Mostrar progresso em barra horizontal
// Cores da barra:
//   < 50% do esperado → linear-gradient(90deg, var(--red), #c03030)
//   50-80% → linear-gradient(90deg, var(--yellow), #e0a800)
//   80-100% → linear-gradient(90deg, var(--green), #1ab87e)
//   > 100% → linear-gradient(90deg, var(--blue), #2196e0) // horas extras
```

**Card de Pontualidade:**
```tsx
// Percentual de dias que chegou até 08:15 (ou horário configurado)
// Badge visual:
//   >= 90% → verde "Excelente"
//   >= 75% → amarelo "Bom"
//   < 75% → vermelho "Atenção"
```

#### Histórico Visual (substituir tabela simples)

Grid de calendário do mês atual com cada dia colorido por status:
```
┌─────────────────────────────────────────────────────────┐
│ Dezembro 2024                                            │
│ ───────────────────────────────────────────────────────│
│  D  S  T  Q  Q  S  S                                    │
│  1  2  3  4  5  6  7    ← cada dia é um card pequeno   │
│  ✓  ✓  ✓  —  ✓  🔥 ✓                                   │
│  8  9 10 11 12 13 14                                    │
│  ✓  ✓  ✓  ✓  ✓  ✓  —                                   │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

Cores dos dias:
- Verde: completo e pontual
- Amarelo: completo mas fora do horário
- Vermelho: falta
- Roxo: encerramento automático
- Cinza: dia não útil (fim de semana/feriado)
- Laranja pulsando: streak ativo

Hover mostra tooltip: `08:02 → 17:35 | 8h30m`

### 2C — Nova Página: Dashboard Analítico de Ponto (Admin)

Criar `apps/web/src/pages/PontoAnalytics.tsx` (rota `/ponto/analytics`).

#### Filtros Rápidos no Topo

```tsx
<div className="filter-quick">
  <button className={periodo === 'hoje' ? 'active' : ''}>Hoje</button>
  <button className={periodo === 'semana' ? 'active' : ''}>Esta Semana</button>
  <button className={periodo === 'mes' ? 'active' : ''}>Este Mês</button>
  <button className={periodo === 'semestre' ? 'active' : ''}>Semestre</button>
  <button className={periodo === 'ano' ? 'active' : ''}>Este Ano</button>
  <button className={periodo === 'custom' ? 'active' : ''}>📅 Personalizado</button>
</div>

{periodo === 'custom' && (
  <div className="filter-range">
    <input type="date" value={startDate} onChange={...} />
    <span>até</span>
    <input type="date" value={endDate} onChange={...} />
  </div>
)}

<select> {/* Filtro por funcionário */}
  <option value="">Todos os funcionários</option>
  {/* ... */}
</select>
```

Estilo dos botões de filtro rápido:
```css
.filter-quick button {
  background: var(--bg3); border: 1px solid var(--border);
  color: var(--text2); padding: 8px 16px; border-radius: 8px;
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.filter-quick button.active {
  background: var(--accent-glow); border-color: var(--accent);
  color: var(--accent2);
}
.filter-quick button:hover:not(.active) {
  border-color: var(--border2); color: var(--text);
}
```

#### Cards de Resumo (4 cards com métricas agregadas)

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Horas │ Presença    │ Pontualid.  │ Enc. Auto   │
│ 1.245h30m   │ 92%         │ 87%         │ 3 casos     │
│ ↑ +8% vs    │ 4 de 5      │ ↓ -2% vs    │ esta semana │
│ mês passado │ funcionários│ mês passado │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

Cada card tem barra colorida no topo (padrão do sistema) e ícone grande.

#### Gráfico de Horas por Funcionário (barra horizontal)

```
Ana Silva     ████████████████████ 182h30m
Carlos Mota   ███████████████░░░░░ 165h15m
Júlia Ramos   ████████████████░░░░ 170h00m
Marcos Lima   ████████████░░░░░░░░ 145h45m
              ─────────────────────
              0h   50h  100h 150h  200h
```

Usar `<ResponsiveContainer>` + `<BarChart>` do Recharts.
Cores das barras: gradiente de `var(--accent)` para `var(--accent2)`.

#### Gráfico de Frequência Semanal (linha)

```
Presença ao longo do período
   5 ┤         ╭─╮
   4 ┤     ╭───╯ ╰╮
   3 ┤   ╭─╯      ╰─╮
   2 ┤ ╭─╯          ╰╮
   1 ┤─╯              ╰──
     └─────────────────────
      S1  S2  S3  S4  S5
```

Usar `<LineChart>` + `<Area>` do Recharts.
Área preenchida com gradiente de `var(--green)` (opacidade 0.3) até transparente.

#### Tabela Detalhada de Pontos

Abaixo dos gráficos, a tabela completa (já existe, melhorar visualmente):
- Adicionar coluna "Enc. Auto" com badge roxo quando `encerramentoAutomatico === true`
- Tooltip no badge: "Saída registrada automaticamente pelo sistema às 22h"
- Linha com encerramento automático tem fundo levemente roxo (`var(--accent-glow)`)

#### Botões de Exportação

```
[⬇ CSV]  [⬇ Excel]  [📄 PDF]  [📧 Enviar Email]
```

**Fluxo de Email:**
1. Clicar em "Enviar Email" abre modal:
   ```
   ┌─────────────────────────────────┐
   │ Enviar Relatório por Email      │
   │ ─────────────────────────────── │
   │ Email destinatário              │
   │ [input]                         │
   │                                 │
   │ ☑ Incluir gráficos no PDF       │
   │ ☑ Incluir tabela detalhada      │
   │                                 │
   │           [Cancelar] [Enviar →] │
   └─────────────────────────────────┘
   ```
2. Chamar `POST /api/pontos/export/email`
3. Toast de sucesso: `📧 Relatório enviado para email@exemplo.com`

### 2D — Hook `usePontoMetricas`

```typescript
export function usePontoMetricas(startDate: string, endDate: string, userId?: string) {
  return useQuery({
    queryKey: ['ponto', 'metricas', startDate, endDate, userId],
    queryFn: () => api.get('/pontos/metricas', { params: { startDate, endDate, userId } }),
    staleTime: 60_000, // 1 minuto
  })
}

export function useExportarPonto() {
  return {
    csv: (params: ExportParams) => {
      // Gerar URL e trigger download
      window.location.href = `/api/pontos/export/csv?${new URLSearchParams(params)}`
    },
    xlsx: (params: ExportParams) => {
      window.location.href = `/api/pontos/export/xlsx?${new URLSearchParams(params)}`
    },
    pdf: useMutation({
      mutationFn: (params: ExportParams & { email?: string }) =>
        api.post('/pontos/export/pdf', params, { responseType: 'blob' }),
      onSuccess: (blob) => {
        // Se tem blob → download
        // Se não (foi enviado por email) → toast
      },
    }),
    email: useMutation({
      mutationFn: (params: ExportParams & { destinatario: string }) =>
        api.post('/pontos/export/email', params),
      onSuccess: () => toast({ icon: '📧', title: 'Email enviado!' }),
    }),
  }
}
```

### 2E — Atualizar Sidebar

Modificar o item "Gestão de Pontos" para ter submenu:
```
📋 Gestão de Pontos
   ├─ Relatório Diário
   └─ Analytics      ← novo, rota /ponto/analytics
```

Ou criar dois itens separados com ícones distintos:
```
⏱️ Registro de Ponto       (já existe)
📋 Relatório de Pontos     (já existe — painel admin)
📊 Analytics de Ponto      (novo)
```

---

## PARTE 3 — COMPONENTES REUTILIZÁVEIS

### 3A — `<MetricCard />` (card motivacional)

```tsx
interface MetricCardProps {
  icon: string
  label: string
  value: string | number
  sublabel?: string
  color: 'green' | 'accent' | 'yellow' | 'orange' | 'red'
  progress?: number  // 0-100, se fornecido mostra barra
  badge?: string     // texto do badge (ex: "Excelente")
}
```

### 3B — `<StreakBadge />` (badge de milestone)

```tsx
interface StreakBadgeProps {
  streak: number
}

// Retorna badge conforme o streak:
// 7-29 dias   → 🔥 1 SEMANA   (laranja)
// 30-89 dias  → 🏆 1 MÊS      (dourado)
// 90-179 dias → 💎 DIAMANTE   (azul)
// 180+ dias   → 👑 LENDÁRIO   (roxo)
```

### 3C — `<CalendarioMensal />` (grid de dias do mês)

```tsx
interface CalendarioMensalProps {
  pontos: Ponto[]
  mes: Date
}

// Renderiza grid 7 colunas (D-S) com cada dia colorido
// Tooltip em cada dia com resumo
// Destaque visual no streak ativo
```

---

## PARTE 4 — DETALHES DE UX/UI

### 4A — Animações nos Gráficos

Recharts já vem com animações. Configurar:
```tsx
<BarChart animationDuration={800} animationEasing="ease-out">
<LineChart animationDuration={1000} animationEasing="ease-in-out">
```

### 4B — Empty States

Quando não há dados no período selecionado:
```
┌──────────────────────────────────┐
│        📊                        │
│  Nenhum registro encontrado      │
│  no período selecionado          │
│                                  │
│  [Alterar filtros]               │
└──────────────────────────────────┘
```

### 4C — Loading States dos Gráficos

Usar skeleton do Recharts ou criar placeholder:
```tsx
// Shimmer em formato de gráfico de barras
<div className="skeleton-chart">
  <div className="bar" style={{ height: '80%' }} />
  <div className="bar" style={{ height: '60%' }} />
  <div className="bar" style={{ height: '90%' }} />
  <div className="bar" style={{ height: '70%' }} />
</div>
```

### 4D — Toasts de Exportação

```tsx
// Ao clicar em exportar:
toast({ icon: '⏳', title: 'Gerando relatório...', message: 'Aguarde' })
// Após sucesso:
toast({ icon: '⬇️', title: 'Download iniciado!', message: 'pontos-2024-12.xlsx' })
// Se email:
toast({ icon: '📧', title: 'Email enviado!', message: 'Confira sua caixa de entrada' })
```

---

## ORDEM DE EXECUÇÃO

1. **Backend — Migration** → adicionar campo `encerramentoAutomatico`
2. **Backend — Job de encerramento** → implementar cron + lógica de fechar pontos
3. **Backend — Endpoint de métricas** → implementar cálculos de streak, horas, pontualidade
4. **Backend — Endpoints de exportação** → CSV, Excel, PDF, Email (instalar libs: exceljs, pdfkit, nodemailer)
5. **Testar API** → confirmar métricas e exportações funcionando
6. **Frontend — Instalar Recharts** → `npm install recharts`
7. **Frontend — Componentes reutilizáveis** → `<MetricCard>`, `<StreakBadge>`, `<CalendarioMensal>`
8. **Frontend — Refatorar página Ponto do funcionário** → adicionar cards motivacionais + calendário
9. **Frontend — Nova página Analytics** → dashboard completo com filtros e gráficos
10. **Frontend — Hooks de exportação** → `useExportarPonto` com mutations
11. **Teste E2E** → simular exportações e verificar emails

---

## DEPENDÊNCIAS NOVAS

Backend:
```json
{
  "node-cron": "^3.0.3",
  "@types/node-cron": "^3.0.11",
  "exceljs": "^4.4.0",
  "pdfkit": "^0.15.0",
  "@types/pdfkit": "^0.13.4",
  "nodemailer": "^6.9.8",
  "@types/nodemailer": "^6.4.14"
}
```

Frontend:
```json
{
  "recharts": "^2.12.0"
}
```

---

## REGRAS

- **Não quebrar funcionalidade existente** — ponto básico continua funcionando
- Job de encerramento às 22h é **crítico** — testar localmente mudando horário do cron para testes
- Exportações devem **preservar o design system** — PDFs com paleta dark adaptada
- Gráficos com **cores do sistema** — não usar paleta padrão do Recharts
- Métricas devem ser **motivacionais**, não punitivas — focar em conquistas e progressão
- TypeScript strict — nenhum `any`
- Após cada etapa: rodar `tsc --noEmit`, confirmar 0 erros

---

## MELHORIAS OPCIONAIS (se houver tempo)

- Push notification no navegador quando streak atinge milestone (7, 30, 90 dias)
- Ranking amigável entre funcionários (gamificação leve, sem pressão)
- Badge de "Funcionário do Mês" baseado em pontualidade + presença
- Previsão de horas até fim do mês com gráfico projetado
- Integração com Google Calendar (exportar pontos como eventos)

---

**Comece pela Etapa 1 — adicione o campo `encerramentoAutomatico` ao schema, rode a migration e implemente o job de encerramento. Após testar o job (pode simular mudando horário), me mostre o output do console.**
