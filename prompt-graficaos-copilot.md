# PROMPT — GráficaOS · Escopo Inicial
> Copie e cole este prompt diretamente no chat do GitHub Copilot (Claude) no VS Code.

---

## CONTEXTO DO PROJETO

Você vai desenvolver o **GráficaOS**, um sistema web interno para uma gráfica com até 10 funcionários. O sistema tem dois módulos principais:

1. **Registro de Ponto** — controle de jornada dos funcionários (entrada, saída para almoço, retorno do almoço, saída final)
2. **Gestão de Artes** — organização do fluxo de produção de artes para orçamentos (kanban com status, arquivos de referência, medidas, cliente, orçamento)

O sistema já tem um protótipo visual aprovado em HTML/CSS/JS puro. Agora vamos construir a versão real com stack moderna.

---

## STACK DEFINIDA

- **Frontend:** React 18 + Vite + TypeScript
- **Estilização:** Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Express + TypeScript
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Autenticação:** JWT com refresh token
- **Upload de arquivos:** Multer (local em desenvolvimento, preparado para S3 em produção)
- **Gerenciamento de estado:** Zustand
- **Requisições HTTP:** Axios + React Query (TanStack Query)

---

## PERFIS DE USUÁRIO

| Perfil | Permissões |
|--------|-----------|
| `ADMIN` | Acesso total — funcionários, pontos, artes, relatórios |
| `EMPLOYEE` | Apenas seu próprio ponto + artes atribuídas a ele |

---

## ESTRUTURA DE PASTAS ESPERADA

```
graficaos/
├── apps/
│   ├── web/                        # Frontend React
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/             # shadcn/ui components
│   │   │   │   ├── layout/         # Sidebar, Topbar, Layout
│   │   │   │   └── modules/        # PontoModule, ArtesModule
│   │   │   ├── pages/              # Dashboard, Ponto, Artes, Funcionarios
│   │   │   ├── hooks/              # useAuth, usePonto, useArtes
│   │   │   ├── stores/             # Zustand stores
│   │   │   ├── services/           # Axios API calls
│   │   │   └── types/              # TypeScript interfaces
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts
│   └── api/                        # Backend Node.js
│       ├── src/
│       │   ├── routes/             # auth, pontos, artes, users
│       │   ├── controllers/
│       │   ├── middlewares/        # auth, upload, errorHandler
│       │   ├── services/
│       │   └── prisma/
│       │       └── schema.prisma
│       └── tsconfig.json
├── package.json                    # Monorepo com workspaces
└── .env.example
```

---

## SCHEMA DO BANCO DE DADOS (Prisma)

Implemente exatamente este schema no arquivo `schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      Role     @default(EMPLOYEE)
  avatarColor String  @default("#6c63ff")
  initials  String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  pontos    Ponto[]
  artes     Arte[]   @relation("ArteResponsavel")
}

model Ponto {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  date      DateTime  @default(now()) @db.Date
  entrada   DateTime?
  almoco    DateTime?
  retorno   DateTime?
  saida     DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([userId, date])
}

model Arte {
  id             String      @id @default(cuid())
  codigo         String      @unique  // ex: ART-001
  clienteNome    String
  clienteNumero  String
  orcamentoNum   String
  produto        ProdutoTipo
  quantidade     Int         @default(1)
  largura        Float
  altura         Float
  responsavelId  String
  responsavel    User        @relation("ArteResponsavel", fields: [responsavelId], references: [id])
  status         ArteStatus  @default(TODO)
  urgencia       Urgencia    @default(NORMAL)
  prazo          DateTime?
  observacoes    String?
  arquivos       Arquivo[]
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}

model Arquivo {
  id           String   @id @default(cuid())
  arteId       String
  arte         Arte     @relation(fields: [arteId], references: [id], onDelete: Cascade)
  nomeOriginal String
  nomeStorage  String
  tipo         String   // "image/jpeg", "application/pdf"
  tamanho      Int
  url          String
  createdAt    DateTime @default(now())
}

enum Role {
  ADMIN
  EMPLOYEE
}

enum ArteStatus {
  TODO
  DOING
  REVIEW
  DONE
}

enum Urgencia {
  LOW
  NORMAL
  HIGH
}

enum ProdutoTipo {
  AZULEJO
  BANNER
  ADESIVO
  PLACA
  FAIXA
  OUTRO
}
```

---

## ROTAS DA API

### Autenticação
```
POST   /api/auth/login           # { email, password } → { token, refreshToken, user }
POST   /api/auth/refresh         # { refreshToken } → { token }
POST   /api/auth/logout
GET    /api/auth/me              # Retorna usuário logado
```

### Usuários (somente ADMIN)
```
GET    /api/users                # Lista todos os funcionários
POST   /api/users                # Cria novo funcionário
PUT    /api/users/:id            # Edita funcionário
DELETE /api/users/:id            # Desativa funcionário (soft delete)
```

### Pontos
```
GET    /api/pontos               # ADMIN: todos | EMPLOYEE: só os seus
GET    /api/pontos/hoje          # Ponto do usuário logado hoje
POST   /api/pontos/bater         # Registra próximo ponto (lógica automática)
GET    /api/pontos/relatorio     # Query params: userId?, startDate, endDate
```

### Artes
```
GET    /api/artes                # ADMIN: todas | EMPLOYEE: só as suas
POST   /api/artes                # Cria nova arte
PUT    /api/artes/:id            # Edita arte
PUT    /api/artes/:id/status     # { status: ArteStatus } — avança status
DELETE /api/artes/:id            # Exclui arte
POST   /api/artes/:id/arquivos   # Upload de arquivo de referência (multipart)
DELETE /api/artes/:id/arquivos/:arquivoId
```

---

## LÓGICA DE NEGÓCIO CRÍTICA

### Endpoint POST /api/pontos/bater
Este é o endpoint mais importante do módulo de ponto. A lógica deve ser:

```typescript
// Ordem dos registros por dia, por usuário:
// 1. entrada   (se entrada === null)
// 2. almoco    (se entrada !== null && almoco === null)
// 3. retorno   (se almoco !== null && retorno === null)
// 4. saida     (se retorno !== null && saida === null)
// Se saida !== null → retornar erro: "Jornada do dia já encerrada"

// Sempre registrar o DateTime exato do momento da batida
// Retornar o Ponto atualizado com todos os campos
```

### Cálculo de Horas Trabalhadas
```typescript
// horas = (saida - entrada) - (retorno - almoco)
// Se almoco existe mas retorno não: não calcular ainda
// Retornar em formato "8h30m"
// Considerar falta se entrada === null no dia
```

---

## REQUISITOS DE SEGURANÇA

- Todas as rotas (exceto `/auth/login`) devem exigir JWT válido via middleware
- EMPLOYEE só pode acessar seus próprios dados — validar no controller, não só no frontend
- Passwords com bcrypt (salt rounds: 12)
- Arquivo `.env` nunca commitado — criar `.env.example` com todas as variáveis necessárias
- Rate limiting no endpoint de login (máx 10 tentativas por IP por minuto)

---

## VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# .env.example
DATABASE_URL="postgresql://user:password@localhost:5432/graficaos"
JWT_SECRET="seu-secret-aqui"
JWT_REFRESH_SECRET="seu-refresh-secret-aqui"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=25
PORT=3333
FRONTEND_URL="http://localhost:5173"
```

---

## SEED DO BANCO DE DADOS

Criar um arquivo `prisma/seed.ts` que popule o banco com dados iniciais para desenvolvimento:

```typescript
// Usuários iniciais:
// 1. Admin — admin@graficaos.com / admin123 / role: ADMIN
// 2. Ana Silva — ana@graficaos.com / 123456 / role: EMPLOYEE / Designer
// 3. Carlos Mota — carlos@graficaos.com / 123456 / role: EMPLOYEE / Produção
// 4. Júlia Ramos — julia@graficaos.com / 123456 / role: EMPLOYEE / Finalizadora
// 5. Marcos Lima — marcos@graficaos.com / 123456 / role: EMPLOYEE / Atendimento

// Criar também 5 artes de exemplo distribuídas entre os funcionários
// em diferentes status (TODO, DOING, REVIEW, DONE)
// e 3 registros de ponto para a semana atual para cada funcionário
```

---

## TAREFA INICIAL — O QUE CONSTRUIR AGORA

Siga esta ordem de desenvolvimento. **Conclua cada etapa antes de avançar para a próxima:**

### ETAPA 1 — Setup do Projeto
1. Inicializar monorepo com `npm workspaces`
2. Configurar `apps/api` com Node.js + Express + TypeScript + Prisma
3. Configurar `apps/web` com Vite + React + TypeScript + Tailwind + shadcn/ui
4. Criar `.env.example` com todas as variáveis
5. Criar `README.md` com instruções de instalação

### ETAPA 2 — Backend: Fundação
1. Configurar Prisma com o schema acima e rodar `prisma migrate dev`
2. Implementar middleware de autenticação JWT
3. Implementar middleware de upload (Multer)
4. Implementar middleware de tratamento de erros global
5. Implementar as rotas de `/auth` completas

### ETAPA 3 — Backend: Módulo Ponto
1. Controller e service de pontos com a lógica de batida automática
2. Cálculo de horas trabalhadas
3. Rota de relatório com filtro por período e usuário

### ETAPA 4 — Backend: Módulo Artes
1. CRUD completo de artes
2. Endpoint de avanço de status
3. Upload e deleção de arquivos de referência

### ETAPA 5 — Seed
1. Criar e rodar o seed com os dados iniciais descritos acima

### ETAPA 6 — Frontend: Fundação
1. Configurar React Router com rotas protegidas
2. Implementar store de autenticação com Zustand
3. Implementar layout principal (Sidebar + Topbar) — **seguir o design dark mode já aprovado**
4. Configurar Axios com interceptors (token + refresh automático)

### ETAPA 7 — Frontend: Módulo Ponto
1. Tela de ponto do funcionário (relógio em tempo real + botão dinâmico + timeline)
2. Histórico semanal do usuário logado
3. Painel admin com tabela de todos os pontos do dia

### ETAPA 8 — Frontend: Módulo Artes
1. Kanban board com drag-and-drop entre colunas de status
2. Card de arte com todas as informações
3. Modal de detalhe da arte
4. Formulário de criação de nova arte com upload de arquivos
5. Filtros por responsável e texto livre

---

## REFERÊNCIA VISUAL

O protótipo aprovado tem as seguintes características visuais que **devem ser mantidas na versão React:**

- **Tema:** Dark mode exclusivo
- **Fonte principal:** Syne (títulos e UI) + JetBrains Mono (dados, horários, códigos)
- **Paleta principal:**
  - Background: `#0a0a0f` / `#11111a` / `#181825`
  - Accent: `#6c63ff` (roxo)
  - Success: `#22d3a0` (verde)
  - Warning: `#f5c542` (amarelo)
  - Danger: `#ff5e5e` (vermelho)
  - Info: `#4db8ff` (azul)
- **Bordas:** `1px solid #2a2a3d`
- **Border-radius:** 12px (cards) / 18px (modais e painéis grandes)
- **Kanban:** 4 colunas com indicador colorido no topo de cada coluna
- **Status do ponto:** Linha do tempo vertical com ícones coloridos por etapa

---

## OBSERVAÇÕES FINAIS

- Use **TypeScript estrito** em todo o projeto (`strict: true` no tsconfig)
- Cada função/controller deve ter tipagem explícita — sem `any`
- Comentários em português nos pontos de lógica de negócio
- Ao terminar cada etapa, informe o que foi feito e pergunte se pode avançar para a próxima
- Se encontrar alguma ambiguidade nas regras de negócio, pergunte antes de implementar
- Priorize código limpo e organizado — este sistema vai crescer

---

**Comece pela ETAPA 1. Após concluir, me mostre a estrutura de pastas criada e aguarde confirmação para avançar.**
