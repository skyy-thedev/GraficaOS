# GraficaOS v3

Data de referência: 13/05/2026
Status do build local: validado

## 1. Resumo executivo

O GraficaOS entrou em uma nova fase operacional com foco em quatro frentes principais:

- consolidação do backend e frontend como plataforma única de operação da gráfica;
- correção de inconsistências em ponto e analytics, principalmente em cenários de folga;
- evolução do módulo de artes com medidas em centímetros e geração automática de orçamento;
- expansão do sistema para operação multiunidade com separação por `PaperOffice I` e `PaperOffice II`.

Nesta versão, o sistema já possui base técnica suficiente para operar como núcleo administrativo da gráfica, cobrindo:

- autenticação e gestão de usuários;
- registro e gestão de ponto;
- analytics gerenciais de ponto;
- gestão de artes com fluxo Kanban;
- agenda de produção;
- gestão operacional;
- checklist diário;
- visão de clientes recorrentes.

---

## 2. Stack e arquitetura

### 2.1 Monorepo

Estrutura principal:

- `apps/api`: backend;
- `apps/web`: frontend;
- raiz com scripts compartilhados de build, deploy e Prisma.

### 2.2 Backend

Local: `apps/api`

Stack:

- `Node.js`
- `Express`
- `Prisma`
- `PostgreSQL`
- `JWT`
- `Luxon`
- `node-cron`
- `multer`
- `exceljs`
- `pdfkit`
- `nodemailer`
- `resend`

Organização:

- `controllers/`: entrada HTTP e validação;
- `services/`: regra de negócio principal;
- `routes/`: rotas da API;
- `middlewares/`: autenticação, erros e upload;
- `utils/timezone.ts`: padronização para São Paulo;
- `jobs/fecharPontos.ts`: automação diária de encerramento de ponto.

### 2.3 Frontend

Local: `apps/web`

Stack:

- `React 18`
- `TypeScript`
- `Vite`
- `React Router`
- `TanStack Query`
- `Zustand`
- `Radix UI`
- `dnd-kit`
- `Recharts`

Organização relevante:

- `pages/`: telas de negócio;
- `hooks/`: consumo de API e estado assíncrono;
- `components/layout/`: navegação, proteção de rota e shell principal;
- `types/`: contratos compartilhados do frontend;
- `utils/`: helpers de negócio, timezone e lojas.

---

## 3. Evoluções implementadas nesta versão

## 3.1 Artes em centímetros

Mudança concluída no domínio de artes:

- medidas passaram de campos genéricos em metros para campos explícitos em centímetros;
- schema Prisma atualizado para `larguraCm` e `alturaCm`;
- frontend atualizado para entrada, exibição e tipagem em centímetros;
- seed e serviços atualizados para refletir a nova unidade.

Arquivos centrais:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/services/arte.service.ts`
- `apps/web/src/types/index.ts`
- `apps/web/src/pages/Artes.tsx`

Impacto positivo:

- reduz ambiguidade de cadastro;
- melhora confiabilidade comercial e produtiva;
- facilita relatórios e integrações futuras.

## 3.2 Geração automática de número de orçamento

O cadastro de nova arte passou a suportar geração automática de `orcamentoNum`.

Implementação principal:

- geração baseada no ano corrente, com prefixo do tipo `ORC-2026-001`;
- lógica centralizada no serviço de artes;
- frontend preparado para trabalhar com preenchimento automático.

Arquivo principal:

- `apps/api/src/services/arte.service.ts`

## 3.3 Correções estruturais no módulo de ponto

Foram corrigidos problemas que afetavam diretamente a confiabilidade dos relatórios:

- folgas configuradas deixaram de ser contabilizadas como faltas;
- datas futuras deixaram de inflar ausência em analytics;
- a UI de gestão diária passou a sintetizar corretamente linhas de `FOLGA` e ausência esperada;
- objetos de ponto no frontend foram alinhados com o novo contexto de loja.

Arquivos principais:

- `apps/api/src/services/ponto.service.ts`
- `apps/web/src/pages/GestaoPontos.tsx`
- `apps/web/src/pages/PontoAnalytics.tsx`
- `apps/web/src/types/index.ts`

## 3.4 Analytics de ponto mais gerencial

O painel analítico evoluiu de relatório simples para visão gerencial:

- melhoria do gráfico de frequência semanal;
- ranking de funcionários com score composto;
- alertas gerenciais por baixa presença, pontualidade e encerramentos automáticos;
- calendário visual recente por funcionário;
- tratamento correto de `PRESENTE`, `FOLGA`, `FALTA` e `FIM_DE_SEMANA`.

Arquivo principal:

- `apps/web/src/pages/PontoAnalytics.tsx`

## 3.5 Gestão de pontos em formato de cards

A visualização administrativa de ponto deixou de ser apenas tabela e passou a usar cards por funcionário.

Melhorias:

- leitura mais rápida em desktop e mobile;
- visual por colaborador com horários destacados;
- melhor suporte a registros sintéticos de folga/ausência;
- ação de edição preservada para registros reais.

Arquivo principal:

- `apps/web/src/pages/GestaoPontos.tsx`

## 3.6 Nova agenda de produção

Foi criada e depois evoluída uma agenda operacional mais dinâmica.

Capacidades atuais:

- navegação por janela de `7` ou `14` dias;
- avanço e retorno semanal;
- filtros por loja, responsável e status;
- seleção de dia para inspeção detalhada;
- visão de carga por responsável na janela;
- leitura operacional mais adequada para produção.

Arquivo principal:

- `apps/web/src/pages/AgendaProducao.tsx`

## 3.7 Gestão operacional

Foi criada uma tela gerencial para leitura da fila de produção.

Capacidades atuais:

- visão consolidada ou por loja;
- tempo médio de conclusão recente;
- gargalos operacionais;
- ranking por responsável;
- volume ativo, urgências resolvidas e retrabalho;
- responsividade melhorada no bloco de ranking.

Arquivo principal:

- `apps/web/src/pages/GestaoOperacional.tsx`

## 3.8 Clientes recorrentes

Foi adicionada uma visão dedicada a recorrência de clientes, apoiando leitura comercial e priorização futura.

Arquivo principal:

- `apps/web/src/pages/ClientesRecorrentes.tsx`

## 3.9 Navegação administrativa simplificada

A navegação do admin foi reorganizada para priorizar o uso diário.

Núcleo principal do admin:

- `Início`
- `Gestão`
- `Analytics`
- `Agenda`

Itens complementares ficaram agrupados separadamente.

Arquivos principais:

- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/MobileNav.tsx`

## 3.10 Separação por loja

O sistema agora suporta segmentação operacional por unidade.

Modelo atual:

- enum `Loja` com `PAPER_OFFICE_I` e `PAPER_OFFICE_II`;
- `User.loja` no banco;
- login e sessão retornam loja do usuário;
- filtros operacionais usam `user.loja` como base de segregação;
- telas administrativas passaram a exibir badges, filtros e agrupamentos por loja.

Arquivos principais:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/services/auth.service.ts`
- `apps/api/src/services/user.service.ts`
- `apps/web/src/types/index.ts`
- `apps/web/src/utils/lojas.ts`
- `apps/web/src/pages/Funcionarios.tsx`
- `apps/web/src/pages/Artes.tsx`
- `apps/web/src/pages/AgendaProducao.tsx`
- `apps/web/src/pages/GestaoOperacional.tsx`

---

## 4. Estado funcional atual por módulo

### 4.1 Autenticação e usuários

Cobertura atual:

- login com JWT;
- refresh token;
- `getMe` com contexto de loja;
- criação, edição, desativação e exclusão definitiva de usuário;
- cadastro de cargo, avatar e loja.

### 4.2 Ponto

Cobertura atual:

- batida sequencial;
- gestão manual;
- criação manual;
- encerramento automático diário;
- folgas por dia da semana;
- relatório por período;
- exportações;
- analytics gerenciais.

### 4.3 Artes

Cobertura atual:

- Kanban por status;
- código sequencial de arte;
- número de orçamento automático;
- medidas em centímetros;
- upload de anexos;
- filtros por responsável, urgência e loja;
- detalhamento da arte e fluxo operacional.

### 4.4 Agenda de produção

Cobertura atual:

- leitura de prazos por janela;
- detalhamento por dia;
- carga por responsável;
- filtros operacionais;
- segmentação por loja.

### 4.5 Gestão operacional

Cobertura atual:

- visão de fila ativa;
- gargalos;
- ranking produtivo;
- distribuição por responsável;
- leitura consolidada ou por unidade.

### 4.6 Checklist diário

Cobertura atual:

- itens configuráveis;
- marcação diária;
- relatórios;
- controle de atraso.

Observação técnica:

- a trilha histórica de auditoria do checklist ainda pode evoluir, principalmente para cenários de desmarcação, remarcação e histórico completo por operador.

---

## 5. Banco de dados e migrações relevantes

### 5.1 Migrações importantes consolidadas

- `20260513120000_arte_dimensoes_cm`
- `20260513143000_add_loja_to_user`

### 5.2 Situação atual do schema

Pontos relevantes do schema:

- `Arte` usa `larguraCm` e `alturaCm`;
- `User` possui `loja` com default `PAPER_OFFICE_I`;
- `PontoStatus` mantém `NORMAL`, `FOLGA` e `FALTA`;
- o domínio já suporta separação operacional por unidade sem duplicar estrutura de tela.

---

## 6. Deploy e operação em produção

## 6.1 Ajustes aplicados para Render

Foram adicionados scripts explícitos para facilitar deploy previsível:

- `render:build`
- `render:start`
- `db:migrate:deploy`
- `start:api`
- geração de client Prisma no build

Arquivos principais:

- `package.json`
- `apps/api/package.json`
- `README.md`

## 6.2 Causa raiz dos incidentes anteriores

Os problemas mais recentes de produção apontavam principalmente para:

- código novo publicado sem migração aplicada no banco;
- fluxo de start/build não alinhado com Prisma em ambiente Render;
- revisão publicada sem script esperado em produção.

Estado atual local:

- migrations aplicam com sucesso;
- backend builda com sucesso;
- frontend builda com sucesso.

---

## 7. Validação técnica executada

Validações concluídas nesta rodada:

- `npm run build:api`
- `npm run build:web`
- `npm run db:migrate:deploy`

Resultado observado:

- sucesso no backend;
- sucesso no frontend;
- sucesso na aplicação da migração de loja.

Observação:

- o build do Vite ainda emite warning de chunk grande no bundle principal, mas sem bloquear compilação.

---

## 8. Riscos e pendências remanescentes

Mesmo com a evolução da v3, ainda existem pontos recomendados para a próxima etapa.

### 8.1 Geração de código de arte

A geração de `codigo` ainda depende de leitura do maior valor textual e retry.

Risco:

- concorrência futura;
- fragilidade conforme a base crescer.

Recomendação:

- mover para sequência numérica persistida em banco ou contador dedicado.

### 8.2 Checklist com auditoria limitada

O módulo ainda pode melhorar em rastreabilidade.

Recomendação:

- criar log de eventos por ação: marcou, desmarcou, reabriu, alterou horário e usuário.

### 8.3 Multi-loja ainda baseada no usuário responsável

A separação atual atende bem ao cenário imediato, mas ainda é um modelo derivado.

Recomendação:

- avaliar no futuro se `Arte`, `Ponto` e outros domínios devem ter `loja` própria persistida, em vez de depender somente de `User.loja`.

### 8.4 Bundle do frontend

O warning de chunk grande sugere oportunidade de otimização.

Recomendação:

- aplicar lazy loading em páginas administrativas pesadas;
- revisar importações grandes em analytics;
- quebrar módulos de visualização quando necessário.

### 8.5 Analytics e agenda com potencial de evolução

A base atual já é boa, mas ainda há espaço para avançar.

Próximos passos recomendados:

- calendário mensal completo da produção;
- drag and drop de replanejamento por data;
- alertas automáticos por atraso crítico;
- filtros salvos por gestor;
- feriados oficiais no motor de presença.

---

## 9. Próximas evoluções recomendadas

Prioridade sugerida para a próxima sprint:

1. persistir `loja` diretamente em entidades críticas, quando fizer sentido de negócio;
2. fortalecer o identificador sequencial de artes no banco;
3. adicionar trilha de auditoria do checklist;
4. otimizar bundle do frontend com carregamento sob demanda;
5. expandir agenda para calendário mensal interativo com replanejamento;
6. incluir feriados e exceções operacionais no analytics de ponto.

---

## 10. Conclusão

O `GraficaOS v3` já representa uma versão significativamente mais madura do sistema.

Os principais ganhos desta fase foram:

- maior consistência de dados no módulo de artes;
- correção de uma falha crítica de negócio em folgas versus faltas;
- criação de uma camada gerencial mais útil para acompanhamento de equipe;
- expansão operacional com agenda e gestão de produção;
- preparação real para operação por múltiplas lojas;
- estabilização do fluxo local de build e migração.

Em resumo, o sistema saiu de uma base funcional com lacunas operacionais para uma plataforma mais confiável, segmentada e orientada à gestão diária da gráfica.
