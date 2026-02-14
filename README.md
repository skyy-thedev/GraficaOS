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

## 🔑 Credenciais de Acesso (Desenvolvimento)

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin | admin@graficaos.com | admin123 |
| Ana Silva | ana@graficaos.com | 123456 |
| Carlos Mota | carlos@graficaos.com | 123456 |
| Júlia Ramos | julia@graficaos.com | 123456 |
| Marcos Lima | marcos@graficaos.com | 123456 |

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
| `npm run db:migrate` | Executa migrações do Prisma |
| `npm run db:seed` | Popula o banco com dados de exemplo |
| `npm run db:studio` | Abre o Prisma Studio |

## 🎨 Design System

- **Tema:** Dark mode exclusivo
- **Fontes:** Syne (UI) + JetBrains Mono (dados)
- **Paleta:** Roxo (#6c63ff), Verde (#22d3a0), Amarelo (#f5c542), Vermelho (#ff5e5e), Azul (#4db8ff)
