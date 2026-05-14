# 🖨️ GráficaOS

Sistema web interno para gráficas — controle de ponto e gestão de artes.

## 📋 Pré-requisitos

- **Node.js** 20+
- **PostgreSQL** 15+
- **npm** 10+

## 🚀 Instalação

### 1. Clone e instale as dependências

```bash
git clone <repo-url>
cd graficaos
npm install
```

### 2. Configure o banco de dados

Crie um banco PostgreSQL chamado `graficaos`:

```sql
CREATE DATABASE graficaos;
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example apps/api/.env
```

Edite `apps/api/.env` com suas credenciais do PostgreSQL.

### 4. Execute as migrações e seed

```bash
npm run db:migrate
npm run db:seed
```

### 5. Inicie o projeto

```bash
# Inicia API e Frontend simultaneamente
npm run dev

# Ou separadamente:
npm run dev:api    # API em http://localhost:3333
npm run dev:web    # Frontend em http://localhost:5173
```

## 📁 Estrutura do Projeto

```
graficaos/
├── apps/
│   ├── api/          # Backend — Node.js + Express + Prisma
│   └── web/          # Frontend — React + Vite + Tailwind
├── package.json      # Monorepo com npm workspaces
└── .env.example
```

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia API + Frontend |
| `npm run dev:api` | Inicia apenas a API |
| `npm run dev:web` | Inicia apenas o Frontend |
| `npm run build` | Build de produção |
| `npm run render:build` | Gera Prisma Client + build da API para Render |
| `npm run render:start` | Aplica migrações e inicia a API em produção |
| `npm run db:migrate` | Executa migrações do Prisma |
| `npm run db:seed` | Popula o banco com dados de exemplo |
| `npm run db:studio` | Abre o Prisma Studio |

## ☁️ Deploy no Render

Para a API no Render, use os comandos abaixo no serviço backend:

- **Build Command:** `npm run render:build`
- **Start Command:** `npm run render:start`

Isso evita dois problemas comuns em produção:

- o servidor subir a partir de código TypeScript/ESM incorreto em vez de `dist/server.js`
- o banco ficar sem as migrações recentes do Prisma, causando erro `500` em rotas como `/api/artes`

## 🌍 Deploy recomendado em produção

Stack recomendada para publicar o monorepo:

- **API + PostgreSQL:** Render
- **Frontend React/Vite:** Vercel

### 1. API no Render

Você pode usar o blueprint `render.yaml` da raiz do projeto ou configurar manualmente.

#### Serviço sugerido

- **Type:** Web Service
- **Environment:** Node
- **Root Directory:** `/`
- **Build Command:** `npm run render:build`
- **Start Command:** `npm run render:start`
- **Health Check Path:** `/api/health`

#### Variáveis obrigatórias da API

```bash
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
FRONTEND_URL=
FRONTEND_URLS=
NODE_ENV=production
PORT=3333
```

#### Variáveis opcionais

```bash
RESEND_API_KEY=
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
HORARIO_ENTRADA_PONTUAL=10:15
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=25
```

> `FRONTEND_URL` deve ser a URL pública principal do frontend, porque ela também é usada para gerar os links do QR code do comprovante.

> `FRONTEND_URLS` pode incluir domínios extras liberados no CORS, separados por vírgula. Exemplo: `https://graficaos.vercel.app,https://www.seudominio.com.br`

### 2. Frontend no Vercel

O frontend já possui `apps/web/vercel.json` com rewrite para SPA.

Na Vercel, configure o projeto apontando para `apps/web` e use:

- **Framework Preset:** Vite
- **Root Directory:** `apps/web`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

#### Variável obrigatória do frontend

```bash
VITE_API_URL=https://SEU-BACKEND.onrender.com
```

### 3. Ordem correta de publicação

1. Suba a **API no Render** e confirme `GET /api/health`
2. Copie a URL da API publicada
3. Configure `VITE_API_URL` no projeto da **Vercel**
4. Faça o deploy do **frontend**
5. Atualize `FRONTEND_URL` e `FRONTEND_URLS` da API com a URL final da Vercel
6. Faça um redeploy rápido da API para garantir CORS e links públicos corretos

### 4. Checklist pós-deploy

- `GET /api/health` responde `200`
- login funciona no frontend publicado
- upload de arquivos funciona
- QR code do comprovante abre a página pública corretamente
- página `/validar-comprovante/:token` carrega dados reais

### 5. Observação importante sobre uploads

Se a API ficar no Render usando filesystem local, a pasta `uploads/` é efêmera entre deploys/restarts.

Para produção estável, o próximo passo recomendado é mover anexos para storage externo, como:

- Cloudinary
- AWS S3
- Supabase Storage
- R2

## 🎨 Design System

- **Tema:** Dark mode exclusivo
- **Fontes:** Syne (UI) + JetBrains Mono (dados)
- **Paleta:** Roxo (#6c63ff), Verde (#22d3a0), Amarelo (#f5c542), Vermelho (#ff5e5e), Azul (#4db8ff)
