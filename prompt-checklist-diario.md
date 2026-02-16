# PROMPT — GráficaOS · Nova Feature: Checklist Diário
> Cole este prompt no chat do GitHub Copilot (Claude) no VS Code.
> O backend e frontend base estão funcionando. Esta é uma adição de nova feature completa (backend + frontend).

---

## CONTEXTO

O cliente solicitou uma nova aba **"Checklist Diário"** no sistema. É uma lista de tarefas de rotina (abrir loja, tirar lixo, limpar chão, organizar estoque etc.) que:

- É **compartilhada por toda a equipe** — um único checklist do dia para todos
- É **restaurada automaticamente todo dia** — cada dia começa com todos os itens desmarcados
- Tem **horário limite** por item (ex: "Abrir a loja" deve ser feito até 08:30)
- O **Admin gerencia os itens** (criar, editar, excluir) e vê o painel completo de progresso
- O **Funcionário** vê a lista do dia e marca os itens como concluídos
- O sistema **guarda histórico** de cumprimento por dia e gera relatório com percentual (%)

---

## PARTE 1 — BACKEND

### 1A — Novos Models no Prisma (`schema.prisma`)

Adicionar ao schema existente **sem alterar nada que já existe**:

```prisma
model ChecklistItem {
  id           String   @id @default(cuid())
  titulo       String
  descricao    String?
  horarioLimite String? // formato "HH:MM", ex: "09:00"
  ordem        Int      @default(0)
  ativo        Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  registros    ChecklistRegistro[]
}

model ChecklistRegistro {
  id         String          @id @default(cuid())
  itemId     String
  item       ChecklistItem   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  userId     String
  user       User            @relation(fields: [userId], references: [id])
  data       DateTime        @db.Date
  feito      Boolean         @default(false)
  feitoEm   DateTime?       // timestamp exato da marcação
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  @@unique([itemId, data])  // um registro por item por dia (compartilhado)
}
```

> **Atenção:** Adicionar também `checklistRegistros ChecklistRegistro[]` no model `User` existente.

Após adicionar, rodar:
```bash
npx prisma migrate dev --name add_checklist
```

### 1B — Novas Rotas (`apps/api/src/routes/checklist.ts`)

```
# Itens (gerenciamento — somente ADMIN)
GET    /api/checklist/itens              # Lista todos os itens ativos (+ inativos para admin)
POST   /api/checklist/itens              # Cria novo item
PUT    /api/checklist/itens/:id          # Edita item (titulo, descricao, horarioLimite, ordem)
PATCH  /api/checklist/itens/:id/toggle   # Ativa/desativa item (soft delete)
DELETE /api/checklist/itens/:id          # Remove permanentemente (com cascata nos registros)

# Registros do dia (todos os perfis)
GET    /api/checklist/hoje               # Retorna itens do dia com status de conclusão
POST   /api/checklist/marcar/:itemId     # Marca/desmarca item como feito (toggle)

# Relatório (somente ADMIN)
GET    /api/checklist/relatorio          # Query: startDate, endDate → percentual por dia
```

### 1C — Lógica do endpoint `GET /api/checklist/hoje`

Este é o endpoint central. A lógica deve ser:

```typescript
// 1. Buscar todos os ChecklistItems ativos, ordenados por `ordem`
// 2. Para cada item, buscar o ChecklistRegistro de hoje (data = hoje, sem filtro de userId)
// 3. Retornar array com estrutura:

interface ItemHoje {
  id: string
  titulo: string
  descricao: string | null
  horarioLimite: string | null  // "HH:MM"
  ordem: number
  feito: boolean
  feitoEm: string | null        // ISO datetime
  feitoPor: {                   // usuário que marcou, se feito
    id: string
    name: string
    initials: string
    avatarColor: string
  } | null
  atrasado: boolean             // horarioLimite existe && !feito && hora atual > horarioLimite
}
```

### 1D — Lógica do endpoint `POST /api/checklist/marcar/:itemId`

```typescript
// Toggle: se já existe registro de hoje para esse item → inverter `feito`
// Se não existe → criar com feito: true, feitoEm: now(), userId: req.user.id
// Se marcar como não feito → limpar feitoEm e userId (feito: false)
// Retornar o ItemHoje atualizado
// Qualquer perfil pode marcar (ADMIN e EMPLOYEE)
```

### 1E — Lógica do endpoint `GET /api/checklist/relatorio`

```typescript
// Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
// Para cada dia no intervalo retornar:

interface RelatorioDia {
  data: string           // "YYYY-MM-DD"
  totalItens: number
  itensConcluidos: number
  percentual: number     // 0-100, arredondar para inteiro
  itens: {
    titulo: string
    feito: boolean
    feitoEm: string | null
    feitoPor: string | null  // nome do usuário
    horarioLimite: string | null
    noHorario: boolean       // feitoEm <= horarioLimite (se ambos existem)
  }[]
}
```

### 1F — Validações Zod

```typescript
// POST /itens
const criarItemSchema = z.object({
  titulo: z.string().min(2).max(100),
  descricao: z.string().max(300).optional(),
  horarioLimite: z.string().regex(/^\d{2}:\d{2}$/).optional(), // "HH:MM"
  ordem: z.number().int().min(0).optional(),
})

// PUT /itens/:id — mesmos campos, todos opcionais
// POST /marcar/:itemId — sem body necessário (toggle)
// GET /relatorio
const relatorioQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
```

### 1G — Atualizar o Seed

Adicionar ao `prisma/seed.ts` **sem remover o seed existente**:

```typescript
// Criar 8 itens de checklist padrão para uma gráfica:
const itensChecklist = [
  { titulo: 'Abrir a loja',            horarioLimite: '08:30', ordem: 1 },
  { titulo: 'Ligar computadores',      horarioLimite: '08:45', ordem: 2 },
  { titulo: 'Verificar emails',        horarioLimite: '09:00', ordem: 3 },
  { titulo: 'Organizar estoque',       horarioLimite: '10:00', ordem: 4 },
  { titulo: 'Limpar área de trabalho', horarioLimite: '10:30', ordem: 5 },
  { titulo: 'Conferir pedidos do dia', horarioLimite: '11:00', ordem: 6 },
  { titulo: 'Tirar o lixo',            horarioLimite: '17:00', ordem: 7 },
  { titulo: 'Fechar e travar a loja',  horarioLimite: '18:30', ordem: 8 },
]
// Criar também registros de hoje com ~60% dos itens marcados (para visualizar o estado)
```

---

## PARTE 2 — FRONTEND

### 2A — Nova rota no React Router

```tsx
// Em AppRouter.tsx (ou onde estão as rotas):
<Route path="/checklist" element={<ProtectedRoute><ChecklistPage /></ProtectedRoute>} />
```

### 2B — Item na Sidebar

Adicionar entre "Registro de Ponto" e "Artes / Gráfica":

```tsx
// nav-item com ícone ✅ e label "Checklist Diário"
// Badge com contagem de itens pendentes do dia (busca do cache TanStack Query)
// Badge: background var(--yellow), cor #0a0a0f quando há itens atrasados
//        background var(--accent), cor #fff quando há itens pendentes normais
//        sem badge quando tudo está concluído
```

### 2C — Página `ChecklistPage.tsx`

#### Layout geral

```
┌─────────────────────────────────────────────────────────────┐
│ TOPBAR: "Checklist Diário"  +  [data de hoje]  +  [relógio] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Barra de progresso do dia]                                │
│  ████████████░░░░░  6 de 8 concluídos · 75%                │
│                                                             │
│  [Botão "+ Novo Item" — somente ADMIN]        [📊 Relatório]│
│                                                             │
│  ┌─ Lista de itens ──────────────────────────────────────┐  │
│  │ ✅  Abrir a loja          até 08:30   Ana · 08:21    │  │
│  │ ✅  Ligar computadores    até 08:45   Carlos · 08:43 │  │
│  │ 🔴  Verificar emails      até 09:00   ATRASADO       │  │
│  │ ○   Organizar estoque     até 10:00                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [Painel de Gestão de Itens — somente ADMIN]                │
└─────────────────────────────────────────────────────────────┘
```

#### Barra de progresso

```tsx
// Estilo:
// Container: background var(--bg4), height 8px, border-radius 4px
// Fill: transition width 0.5s ease
// Cor do fill:
//   100% → linear-gradient(90deg, var(--green), #1ab87e)
//   >= 50% → linear-gradient(90deg, var(--accent), #9b8fff)
//   < 50% → linear-gradient(90deg, var(--yellow), #e0a800)
// Texto acima: "[N] de [TOTAL] concluídos · [%]%"
//   fonte JetBrains Mono 13px, cor var(--text2)
```

#### Card de cada item da lista

```
┌─────────────────────────────────────────────────────────────┐
│  [checkbox]  Abrir a loja              [tag: até 08:30]     │
│              Descrição opcional aqui   [avatar] Ana · 08:21 │
└─────────────────────────────────────────────────────────────┘
```

**Estados visuais do card:**

```css
/* Concluído no horário */
border-left: 3px solid var(--green);
background: var(--bg2);
/* titulo: text-decoration: line-through; color: var(--text3) */

/* Pendente — dentro do prazo */
border-left: 3px solid var(--border2);
background: var(--bg2);

/* ATRASADO — horário passou e não foi feito */
border-left: 3px solid var(--red);
background: linear-gradient(90deg, var(--red-dim), transparent);
/* badge "ATRASADO": red-dim background, red color, JetBrains Mono 10px */

/* Concluído fora do horário */
border-left: 3px solid var(--yellow);
background: var(--bg2);
/* badge "FORA DO PRAZO": yellow-dim background, yellow color */
```

**Checkbox estilizado:**
```css
/* Não usar o checkbox nativo — criar custom */
width: 22px; height: 22px; border-radius: 6px;
border: 1.5px solid var(--border2);
cursor: pointer; transition: all 0.15s;
display: flex; align-items: center; justify-content: center;

/* Hover: border-color var(--accent) */
/* Checked: background var(--green); border-color var(--green); ✓ branco dentro */
/* Atrasado checked: background var(--yellow); border-color var(--yellow) */
```

**Tag de horário limite:**
```css
font-family: 'JetBrains Mono', monospace; font-size: 11px;
padding: 3px 8px; border-radius: 20px; border: 1px solid;
/* Normal:   color var(--text3), border var(--border) */
/* Atrasado: color var(--red),   border var(--red),   background var(--red-dim) */
/* Concluído no horário: color var(--green), border var(--green), background var(--green-dim) */
```

**Info de quem concluiu (quando feito):**
```tsx
// Mostrar: [avatar 20px] [nome] · [hora HH:MM]
// fonte JetBrains Mono 11px, cor var(--text3)
// avatar: iniciais + avatarColor do usuário que marcou
```

#### Interação de marcar/desmarcar

```tsx
// Ao clicar no checkbox:
// 1. Optimistic update — atualizar UI imediatamente (não esperar API)
// 2. Chamar POST /api/checklist/marcar/:itemId
// 3. Se API falhar → reverter + toast de erro
// 4. Se sucesso → toast de feedback:
//    ✅ "Concluído!" / itemTitulo    (ao marcar)
//    ○  "Desmarcado"  / itemTitulo   (ao desmarcar)
// 5. Invalidar query do badge na sidebar
```

#### Painel de Gestão (somente ADMIN — seção separada abaixo da lista)

```
┌─ Gerenciar Itens ─────────────────────────────────────────┐
│ [título da seção em uppercase JetBrains Mono]              │
│                                                            │
│  Abrir a loja         08:30  ordem:1  [✏️ Editar] [🗑️]   │
│  Ligar computadores   08:45  ordem:2  [✏️ Editar] [🗑️]   │
│  ...                                                       │
│                                                            │
│  [+ Adicionar Item]                                        │
└────────────────────────────────────────────────────────────┘
```

### 2D — Modal de Criar/Editar Item (somente ADMIN)

```
┌─────────────────────────────────┐
│ Novo Item de Checklist          │
│ ─────────────────────────────── │
│ Título *                        │
│ [input]                         │
│                                 │
│ Descrição (opcional)            │
│ [textarea 2 linhas]             │
│                                 │
│ Horário Limite                  │
│ [input type="time"]             │
│ ex: itens da manhã devem ser    │
│ feitos até este horário         │
│                                 │
│ Ordem de exibição               │
│ [input number]                  │
│                                 │
│           [Cancelar] [Salvar →] │
└─────────────────────────────────┘
```

Usar os mesmos estilos de modal já existentes no sistema (`.modal`, `.modal-overlay`, etc.)

### 2E — Modal de Relatório (somente ADMIN)

```
┌──────────────────────────────────────────────────────┐
│ 📊 Relatório de Cumprimento                          │
│ ──────────────────────────────────────────────────── │
│ Período: [date input início]  até  [date input fim]  │
│                          [Buscar]                    │
│ ──────────────────────────────────────────────────── │
│                                                      │
│  Seg 09/12   ████████████░░   75%   6/8 itens       │
│  Ter 10/12   ████████████████ 100%  8/8 itens  ✅   │
│  Qua 11/12   ████████░░░░░░░  50%   4/8 itens       │
│  Qui 12/12   ██░░░░░░░░░░░░░  25%   2/8 itens  ⚠️   │
│                                                      │
│  Média do período: 62.5%                             │
│                               [Exportar CSV →]       │
└──────────────────────────────────────────────────────┘
```

**Barra de progresso no relatório:**
```css
/* Verde se >= 80%, Roxo se >= 50%, Amarelo se < 50% */
/* height: 6px; border-radius: 3px */
/* largura proporcional ao percentual, dentro de um track de 160px */
```

**Exportar CSV** (client-side):
```typescript
// Colunas: Data, Total Itens, Concluídos, Percentual, [nome de cada item com S/N]
// Filename: checklist-relatorio-YYYY-MM-DD.csv
```

### 2F — Hook `useChecklist`

```typescript
// hooks/useChecklist.ts
export function useChecklistHoje() {
  return useQuery({
    queryKey: ['checklist', 'hoje'],
    queryFn: () => api.get('/checklist/hoje').then(r => r.data),
    refetchInterval: 30_000, // atualiza a cada 30s (outro funcionário pode ter marcado)
    staleTime: 10_000,
  })
}

export function useMarcarItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => api.post(`/checklist/marcar/${itemId}`),
    onMutate: async (itemId) => {
      // Optimistic update aqui
      await queryClient.cancelQueries({ queryKey: ['checklist', 'hoje'] })
      const anterior = queryClient.getQueryData(['checklist', 'hoje'])
      queryClient.setQueryData(['checklist', 'hoje'], (old: ItemHoje[]) =>
        old.map(item => item.id === itemId ? { ...item, feito: !item.feito } : item)
      )
      return { anterior }
    },
    onError: (_err, _itemId, context) => {
      queryClient.setQueryData(['checklist', 'hoje'], context?.anterior)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', 'hoje'] })
    },
  })
}

export function useRelatorioChecklist() {
  // useQuery com startDate e endDate como parâmetros
}

export function useGerenciarItens() {
  // useMutation para criar, editar, deletar itens (admin only)
}
```

---

## PARTE 3 — INTEGRAÇÃO COM O SISTEMA EXISTENTE

### 3A — Atualizar Dashboard

No card de resumo do Dashboard, adicionar um **4º widget** (ou substituir um placeholder):

```
┌──────────────────────────────────┐
│ ✅  Checklist Hoje               │
│     ████████░░  75%              │
│     6 de 8 itens concluídos      │
└──────────────────────────────────┘
```
Clicar no widget navega para `/checklist`.

### 3B — Atualizar tipos TypeScript

Criar arquivo `apps/web/src/types/checklist.ts`:

```typescript
export interface ChecklistItemConfig {
  id: string
  titulo: string
  descricao: string | null
  horarioLimite: string | null  // "HH:MM"
  ordem: number
  ativo: boolean
}

export interface ItemHoje extends ChecklistItemConfig {
  feito: boolean
  feitoEm: string | null
  feitoPor: {
    id: string
    name: string
    initials: string
    avatarColor: string
  } | null
  atrasado: boolean
}

export interface RelatorioDia {
  data: string
  totalItens: number
  itensConcluidos: number
  percentual: number
  itens: {
    titulo: string
    feito: boolean
    feitoEm: string | null
    feitoPor: string | null
    horarioLimite: string | null
    noHorario: boolean
  }[]
}
```

---

## ORDEM DE EXECUÇÃO

Execute nesta sequência e confirme cada etapa:

1. **Backend — Schema e Migration** → adicionar models, rodar `prisma migrate dev`
2. **Backend — Routes e Controllers** → implementar todos os endpoints com validação Zod
3. **Backend — Seed** → adicionar itens padrão e registros de hoje
4. **Testar API** → confirmar que `GET /api/checklist/hoje` retorna dados corretos
5. **Frontend — Tipos e Hook** → criar `checklist.ts` e `useChecklist.ts`
6. **Frontend — Página base** → rota, sidebar, layout, barra de progresso
7. **Frontend — Lista de itens** → cards com todos os estados visuais + checkbox
8. **Frontend — Painel admin** → gerenciamento de itens + modal criar/editar
9. **Frontend — Modal relatório** → tabela de dias + exportar CSV
10. **Frontend — Dashboard widget** → card de progresso do checklist

---

## REGRAS

- **Não alterar** nenhum model, rota ou componente existente — apenas adicionar
- O checklist é **compartilhado**: um único registro por item por dia, independente de qual funcionário marcou
- **Optimistic update obrigatório** no marcar/desmarcar — a interação deve parecer instantânea
- **TypeScript strict** — sem `any`, sem erros de compilação
- O `refetchInterval: 30s` garante que se outro funcionário marcar um item, todos verão atualizado
- Após cada etapa: rodar `tsc --noEmit`, confirmar 0 erros e descrever o que foi feito

---

**Comece pela Etapa 1 — adicione os models ao `schema.prisma`, rode a migration e me mostre o output do terminal.**
