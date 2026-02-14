# PROMPT — GráficaOS · Sprint de Refinamento Visual e Funcional
> Cole este prompt no chat do GitHub Copilot (Claude) no VS Code.
> Contexto: o backend está 100% pronto. O frontend tem infraestrutura sólida mas diverge visualmente do protótipo aprovado e tem lacunas funcionais críticas.

---

## CONTEXTO

O GráficaOS tem um **protótipo visual aprovado pelo cliente** (HTML/CSS/JS puro) que serviu como referência de design. O frontend React atual funciona, mas está **divergindo visualmente** desse protótipo em vários pontos e tem **funcionalidades do escopo original ausentes**.

O objetivo desta sprint é: **aproximar o frontend React o máximo possível do protótipo aprovado** e fechar as lacunas funcionais identificadas.

Siga as tarefas na ordem apresentada. Conclua e confirme cada uma antes de avançar.

---

## REFERÊNCIA VISUAL DO PROTÓTIPO APROVADO

Este é o design system exato que deve ser seguido. Se o código atual diverge desses valores, **corrija**.

### Tokens CSS (aplicar como variáveis CSS globais em `index.css`)

```css
:root {
  /* Backgrounds */
  --bg:      #0a0a0f;
  --bg2:     #11111a;
  --bg3:     #181825;
  --bg4:     #1f1f30;

  /* Borders */
  --border:  #2a2a3d;
  --border2: #3a3a55;

  /* Text */
  --text:    #e8e8f0;
  --text2:   #9090b0;
  --text3:   #5a5a7a;

  /* Accent (roxo) */
  --accent:      #6c63ff;
  --accent2:     #8b85ff;
  --accent-glow: rgba(108, 99, 255, 0.15);

  /* Semânticas */
  --green:       #22d3a0;
  --green-dim:   rgba(34, 211, 160, 0.12);
  --yellow:      #f5c542;
  --yellow-dim:  rgba(245, 197, 66, 0.12);
  --red:         #ff5e5e;
  --red-dim:     rgba(255, 94, 94, 0.12);
  --blue:        #4db8ff;
  --blue-dim:    rgba(77, 184, 255, 0.12);
  --orange:      #ff9d4d;
  --orange-dim:  rgba(255, 157, 77, 0.12);

  /* Geometry */
  --radius:    12px;
  --radius-lg: 18px;
  --shadow:    0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.6);
}
```

### Tipografia
- **Fonte UI:** `Syne` (400, 600, 700, 800) — todos os textos de interface
- **Fonte dados:** `JetBrains Mono` (300, 400, 500) — horários, IDs, badges, código, labels uppercase
- Import no `index.html`:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  ```

### Scrollbar customizada
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg2); }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
```

---

## TAREFA 1 — Sistema de Toast (Prioridade Máxima)

**Situação atual:** Nenhuma página tem feedback visual de sucesso/erro. O usuário não sabe se uma ação funcionou.

**O que fazer:**
Criar um hook `useToast` e um componente `<ToastContainer />` que replique **exatamente** este comportamento do protótipo:

```css
/* Estilo do Toast — replicar exatamente */
.toast-container {
  position: fixed; bottom: 24px; right: 24px;
  z-index: 999; display: flex; flex-direction: column; gap: 8px;
}
.toast {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px 18px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: var(--shadow-lg); min-width: 280px;
  animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  font-size: 13px;
}
@keyframes toastIn { from { opacity: 0; transform: translateX(30px); } }
.toast.removing { animation: toastOut 0.3s forwards; }
@keyframes toastOut { to { opacity: 0; transform: translateX(30px); } }
/* .toast-icon: font-size 18px */
/* .toast-msg strong: font-weight 700, color var(--text) */
/* .toast-msg span: color var(--text3), font-size 12px, JetBrains Mono */
```

**API do hook:**
```typescript
const { toast } = useToast()
toast({ icon: '✅', title: 'Arte criada!', message: '#ART-007 · Cliente X' })
toast({ icon: '❌', title: 'Erro', message: 'Não foi possível salvar.' })
// Auto-dismiss em 3.5 segundos com animação de saída
```

**Onde adicionar toasts** (usar nas mutations do TanStack Query):
- Criar arte → `✅ Arte criada!` / `❌ Erro ao criar arte`
- Editar arte → `✅ Arte atualizada!` / `❌ Erro`
- Excluir arte → `🗑️ Arte removida`
- Avançar status → `🎨 Status atualizado → [novo status]`
- Upload de arquivo → `📎 Arquivo anexado`
- Excluir arquivo → `🗑️ Arquivo removido`
- Criar funcionário → `✅ Funcionário criado!`
- Editar funcionário → `✅ Dados atualizados`
- Desativar funcionário → `⚠️ Funcionário desativado`
- Reativar funcionário → `✅ Funcionário reativado`
- Bater ponto → `⏱️ [Entrada/Almoço/Retorno/Saída] registrado às HH:MM`

---

## TAREFA 2 — Completar Página de Ponto

**Situação atual:** A página tem apenas ~108 linhas. Faltam: histórico semanal, cálculo de horas, painel admin.

### 2A — Layout Hero (já existe, verificar conformidade visual)

O layout deve ser `grid: 1fr 340px`, com:

**Card esquerdo — Relógio:**
```
┌─────────────────────────────────────────────┐
│  [gradiente radial roxo sutil no fundo]      │
│                                              │
│      08 : 32 : 47    ← JetBrains Mono 72px  │
│      os ":" são cor --accent2                │
│   Quinta, 12 Dez 2024  ← text3, mono 14px   │
│                                              │
│   [ botão dinâmico com gradiente ]           │
│   ● Trabalhando  ← dot animado + label       │
└─────────────────────────────────────────────┘
```

**Botão dinâmico — 4 estados com gradientes:**
```typescript
// Estado 0: nenhum registro
{ label: 'Registrar Entrada',  gradient: 'linear-gradient(135deg, #22d3a0, #1ab87e)', shadow: 'rgba(34,211,160,0.3)' }
// Estado 1: entrada feita
{ label: 'Saída para Almoço',  gradient: 'linear-gradient(135deg, #f5c542, #e0a800)', shadow: 'rgba(245,197,66,0.3)', color: '#0a0a0f' }
// Estado 2: almoço registrado
{ label: 'Retorno do Almoço',  gradient: 'linear-gradient(135deg, #4db8ff, #2196e0)', shadow: 'rgba(77,184,255,0.3)' }
// Estado 3: retorno feito
{ label: 'Registrar Saída',    gradient: 'linear-gradient(135deg, #ff5e5e, #e03030)', shadow: 'rgba(255,94,94,0.3)' }
// Estado 4: completo
{ label: 'Expediente Encerrado', background: 'var(--bg4)', color: 'var(--text2)', disabled: true }
```

**Card direito — Timeline do dia:**
```
┌─────────────────────────┐
│ Registro de hoje        │
│─────────────────────────│
│ ●  08:02   Entrada      │  ← dot verde preenchido
│ ●  12:05   Saída Almoço │  ← dot amarelo
│ ○  —       Retorno      │  ← dot tracejado (pendente)
│ ○  —       Saída        │  ← dot tracejado
└─────────────────────────┘
```
- Dots preenchidos: 32×32px, fundo `var(--[cor]-dim)`, ícone emoji
- Dots pendentes: 32×32px, fundo `var(--bg4)`, borda `1.5px dashed var(--border2)`
- Cada item separado por `border-bottom: 1px solid var(--border)`

### 2B — Card de Resumo do Dia (NOVO — abaixo do hero)

```
┌──────────┬──────────┬──────────┬──────────┐
│ Entrada  │ Almoço   │ Retorno  │ Horas    │
│ 08:02    │ 12:05    │ —        │ em curso │
│ tag verde│ tag amar.│ tag cinza│ tag roxa │
└──────────┴──────────┴──────────┴──────────┘
```
Grid 4 colunas, cada célula com label em JetBrains Mono uppercase 11px e valor com tag colorida.

### 2C — Histórico Semanal (NOVO — card abaixo)

Tabela com colunas: `DATA | ENTRADA | ALMOÇO | RETORNO | SAÍDA | HORAS | STATUS`

Regras visuais:
- Cada horário em tag colorida (mesmo padrão do protótipo)
- Coluna HORAS em JetBrains Mono
- Status: `Completo` (tag verde) / `Parcial` (tag amarela) / `Falta` (tag vermelha) / `Hoje` (tag roxa)
- Buscar da API: `GET /api/pontos?startDate=INICIO_SEMANA&endDate=HOJE`

### 2D — Painel Admin (NOVO — visível só para ADMIN)

Renderizar **acima** do histórico quando o usuário for ADMIN. Deve conter:

**Filtros:**
```
[input date — hoje por padrão]  [select — todos os funcionários]  [botão Exportar CSV →]
```

**Tabela:** `FUNCIONÁRIO | DATA | ENTRADA | ALMOÇO | RETORNO | SAÍDA | HORAS | STATUS`
- Coluna funcionário com avatar circular (iniciais + cor) + nome + cargo
- Mesmas tags coloridas para horários
- Horas calculadas igual ao protótipo: `(saida - entrada) - (retorno - almoco)` → `"8h30m"`
- Buscar da API: `GET /api/pontos/relatorio?startDate=X&endDate=Y&userId=Z`

**Botão Exportar CSV:** gerar e baixar CSV com os dados filtrados (client-side, sem backend)

---

## TAREFA 3 — Correções Visuais no Kanban de Artes

**Situação atual:** O kanban funciona mas diverge visualmente do protótipo.

### 3A — Barra colorida no topo de cada coluna
```css
/* Cada coluna deve ter uma linha de 2px no topo */
.kanban-col-todo   > header::before { background: var(--text3); }
.kanban-col-doing  > header::before { background: var(--blue); }
.kanban-col-review > header::before { background: var(--yellow); }
.kanban-col-done   > header::before { background: var(--green); }
/* Implementar via position: absolute, top: 0, height: 2px, width: 100% */
```

### 3B — Barra lateral nos cards (left accent)
Cada card deve ter uma barra vertical de `3px` na borda esquerda, com a cor correspondente ao status da coluna em que está. Usar `::before` pseudo-element.

### 3C — Badge de urgência no card
- `🔴` HIGH — com `box-shadow: 0 0 6px var(--red)` no dot
- `🟡` NORMAL
- `🟢` LOW
- Exibir no canto inferior direito do card, ao lado do avatar do responsável

### 3D — Indicador de prazo vencido (NOVO)
Se `prazo < hoje` e `status !== DONE`:
- Adicionar badge `ATRASADO` com: `background: var(--red-dim); color: var(--red); border: 1px solid var(--red); font-family: JetBrains Mono; font-size: 10px; padding: 2px 6px; border-radius: 20px`
- Exibir na linha de meta do card, ao lado da data do prazo

### 3E — Filtro por urgência (NOVO)
Adicionar ao filter-row existente:
```tsx
<select> // filterUrgencia
  <option value="">Todas urgências</option>
  <option value="HIGH">🔴 Urgente</option>
  <option value="NORMAL">🟡 Normal</option>
  <option value="LOW">🟢 Baixa</option>
</select>
```

### 3F — Substituir window.confirm por Dialog styled
Usar o componente `Dialog` do shadcn/ui já disponível. Ao excluir arte ou arquivo:
```
┌─────────────────────────────┐
│ Excluir arte?               │
│ Esta ação não pode ser      │
│ desfeita.                   │
│              [Cancelar] [Excluir] │
└─────────────────────────────┘
```
Botão "Excluir": `background: var(--red-dim); color: var(--red); border: 1px solid var(--red)`

---

## TAREFA 4 — Correções na Página de Funcionários

### 4A — Botão Reativar funcionário
Na listagem de inativos, adicionar botão:
```tsx
<button // só visível quando user.active === false
  style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green)' }}
  onClick={() => reativarFuncionario(user.id)}
>
  Reativar
</button>
```
Chamar `PUT /api/users/:id` com `{ active: true }`.

### 4B — Substituir window.confirm por Dialog styled
Mesmo padrão da Tarefa 3F, aplicar na desativação de funcionários.

---

## TAREFA 5 — Ajustes no Dashboard

### 5A — Cards de stats com barra colorida no topo
Cada stat card deve ter `position: relative; overflow: hidden` e um `::before` com:
```css
content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
/* card verde: */ background: linear-gradient(90deg, var(--green), transparent);
/* card roxo: */  background: linear-gradient(90deg, var(--accent), transparent);
/* card amar: */  background: linear-gradient(90deg, var(--yellow), transparent);
/* card neutro: */ background: linear-gradient(90deg, var(--text3), transparent);
```

### 5B — Lista de pontos de hoje
Os itens da lista de pontos no dashboard devem seguir este padrão:
```
┌─────────────────────────────────────┐
│ [avatar] Ana Silva        🟢        │
│          08:02 → em curso           │
└─────────────────────────────────────┘
```
- Avatar: 28×28px circular, iniciais, cor do usuário
- Horário em JetBrains Mono 11px, `var(--text3)`
- Emoji de status: 🟢 trabalhando / 🟡 almoço / ⚫ ausente / ✅ completo

### 5C — Lista de artes urgentes
Itens da lista de artes no dashboard:
```
┌─────────────────────────────────────────┐
│ ● Cliente X — Azulejo (3x)      🔴     │
│   #ART-001 · Ana Silva                  │
└─────────────────────────────────────────┘
```
- Dot colorido pelo status (azul/amarelo/cinza)
- Clicar no item abre o modal de detalhe da arte

---

## TAREFA 6 — UX Global

### 6A — Sidebar: badge de artes ativas
O item "Artes & Produção" na sidebar deve mostrar um badge com a contagem de artes não concluídas:
```tsx
// Badge estilo:
// background: var(--accent); color: #fff;
// font-size: 10px; padding: 1px 6px; border-radius: 20px;
// font-family: JetBrains Mono;
// margin-left: auto;
```
Buscar do cache do TanStack Query (não fazer nova requisição).

### 6B — Skeleton loaders
Substituir todos os textos "Carregando..." por shimmer placeholders:
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}
```
Aplicar em: Dashboard (cards de stat, listas), Artes (colunas kanban), Funcionários (cards).

### 6C — Empty states
Quando uma coluna do kanban ou lista estiver vazia, exibir:
```
[ícone 36px centralizado]
Nenhuma arte aqui
```
- Container: `padding: 40px; text-align: center; color: var(--text3); font-size: 13px`

### 6D — Responsividade mobile básica
Adicionar ao CSS global:
```css
@media (max-width: 768px) {
  /* Sidebar: ocultar por padrão, mostrar com botão hamburger na topbar */
  /* Kanban: grid de 1 coluna com scroll horizontal */
  /* Stats grid: 2 colunas */
  /* Ponto hero: 1 coluna */
  /* Topbar: mostrar botão ≡ para abrir sidebar */
}
```
O botão hamburger na topbar deve fazer toggle de uma classe `sidebar-open` no body.

---

## ORDEM DE EXECUÇÃO

Execute nesta sequência exata:

1. **Tarefa 1** — Toast system (desbloqueia feedback em tudo)
2. **Tarefa 2** — Completar página de Ponto (lacuna mais crítica)
3. **Tarefa 3** — Correções visuais no Kanban
4. **Tarefa 4** — Funcionários: reativar + dialog
5. **Tarefa 5** — Dashboard: ajustes visuais
6. **Tarefa 6** — UX global

---

## REGRAS GERAIS

- **Não altere nada no backend** — está 100% completo e funcional
- **Não quebre o que funciona** — Artes kanban com drag-and-drop está funcionando, só ajuste o visual
- **TypeScript strict** — nenhum `any`, nenhum erro de compilação ao final
- **Após cada tarefa**: compile (`tsc --noEmit`), confirme 0 erros e descreva o que foi feito
- **Nomes em português** nos comentários de lógica de negócio
- Se encontrar conflito entre Tailwind e CSS custom, **priorize o CSS custom com variáveis** — o design system usa variáveis CSS nativas, não classes Tailwind para cores

---

**Comece pela Tarefa 1. Após implementar o sistema de Toast e adicionar os toasts nas mutations existentes, compile e me mostre quais arquivos foram criados/modificados.**
