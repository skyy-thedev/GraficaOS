# Situação Atual do Sistema GraficaOS

Data de referência: 13/05/2026

## 1. Objetivo deste documento

Este documento consolida a situação técnica atual do GraficaOS para apoiar a próxima atualização do sistema. O foco é registrar:

- arquitetura e stack atual;
- módulos já existentes;
- problemas e riscos identificados no código;
- oportunidades de melhoria para a operação diária da gráfica;
- recomendação específica para a troca da medição das artes de metros para centímetros.

## 2. Visão geral do sistema

O GraficaOS é um sistema web interno para gestão operacional de uma gráfica, organizado em monorepo com duas aplicações principais:

- `apps/api`: backend em Node.js + Express + Prisma + PostgreSQL;
- `apps/web`: frontend em React + Vite + TypeScript.

O sistema hoje atende principalmente três frentes:

1. controle de ponto dos funcionários;
2. gestão de artes;
3. checklist diário operacional.

## 3. Arquitetura atual

### 3.1 Backend

Local: `apps/api`

Stack principal:

- Node.js com `Express`;
- `Prisma` para ORM e migrações;
- `PostgreSQL` como banco principal;
- `JWT` para autenticação;
- `node-cron` para encerramento automático de pontos;
- `multer` para upload de arquivos;
- exportações via `exceljs`, `pdfkit`, `nodemailer` e `resend`.

Estrutura observada:

- `controllers/`: validação e entrada HTTP;
- `services/`: regras de negócio;
- `routes/`: definição das rotas;
- `middlewares/`: autenticação, upload e tratamento de erros;
- `utils/timezone.ts`: padronização de datas para São Paulo;
- `jobs/fecharPontos.ts`: rotina automatizada de encerramento.

### 3.2 Frontend

Local: `apps/web`

Stack principal:

- `React 18` + `TypeScript`;
- `Vite`;
- `React Router`;
- `TanStack React Query`;
- `Zustand`;
- componentes UI próprios com Radix;
- gráficos com `Recharts`;
- drag and drop com `dnd-kit`.

Principais páginas identificadas:

- `Dashboard`;
- `Ponto`;
- `Gestão de Pontos`;
- `Ponto Analytics`;
- `Artes`;
- `Checklist Diário`;
- `Funcionários`;
- `Login`.

## 4. Modelo funcional atual

### 4.1 Controle de ponto

Capacidades atuais:

- batida sequencial automática: entrada, almoço, retorno e saída;
- visualização do ponto do dia;
- gestão administrativa de pontos;
- edição manual de registros;
- criação manual de ponto;
- configuração de folgas por dia da semana;
- analytics com métricas, anomalias, insights e exportações;
- encerramento automático diário por job agendado.

Modelos relacionados no banco:

- `User`;
- `Ponto`;
- `FolgaConfig`.

### 4.2 Gestão de artes

Capacidades atuais:

- cadastro de arte com código sequencial automático;
- dados do cliente e orçamento;
- tipo de produto;
- quantidade, largura e altura;
- responsável pela arte;
- urgência e prazo;
- observações;
- anexos por upload;
- fluxo Kanban com status `TODO`, `DOING`, `REVIEW`, `DONE`.

Modelos relacionados no banco:

- `Arte`;
- `Arquivo`.

### 4.3 Checklist diário

Capacidades atuais:

- cadastro e ordenação de itens de checklist;
- definição de horário limite por item;
- marcação do item do dia;
- relatório por período;
- indicação de atraso.

Modelos relacionados no banco:

- `ChecklistItem`;
- `ChecklistRegistro`.

## 5. Pontos positivos do estado atual

- arquitetura separada entre API e Web, facilitando evolução por módulo;
- uso de `Prisma` e migrações, o que dá boa base para evolução do banco;
- tratamento explícito de timezone de São Paulo em áreas críticas;
- módulo de ponto já relativamente avançado, com analytics e exportação;
- fluxo visual de artes em Kanban, coerente com a operação diária;
- uso de TypeScript em backend e frontend, reduzindo parte dos erros de integração.

## 6. Problemas e erros identificados para correção

Abaixo estão os principais pontos de atenção encontrados no estado atual do sistema.

### 6.1 Medição das artes em metros, quando o negócio precisa trabalhar em centímetros

Status atual:

- o modelo `Arte` possui apenas `largura` e `altura` como `Float`, sem unidade explícita em banco;
- o frontend exibe as medidas com sufixo em metros, por exemplo em `apps/web/src/pages/Artes.tsx`;
- a API valida apenas que os números sejam positivos, sem explicitar unidade ou escala.

Problema:

- a regra de negócio fica ambígua;
- o cadastro depende da interpretação humana do campo;
- aumenta o risco de erros comerciais, impressão incorreta e retrabalho;
- a ausência de unidade no schema dificulta integrações futuras e relatórios confiáveis.

Recomendação:

- migrar a regra de negócio para centímetros;
- preferencialmente trocar os campos para `larguraCm` e `alturaCm` como inteiros;
- atualizar frontend, API, seed, exportações e relatórios;
- criar uma migração para converter os valores existentes de metros para centímetros multiplicando por 100;
- opcionalmente manter compatibilidade temporária na API por uma versão para evitar quebra abrupta.

Impacto técnico esperado:

- banco de dados: migração de schema e dados;
- backend: validação, DTOs, services e serialização;
- frontend: formulários, cards, filtros e qualquer cálculo exibido;
- documentação: atualização do glossário e exemplos de cadastro.

### 6.2 Geração de código de arte com risco de colisão e inconsistência futura

Local principal: `apps/api/src/services/arte.service.ts`

Status atual:

- o código da arte é gerado buscando o maior `codigo` em ordem decrescente textual;
- o formato atual é `ART-001`, `ART-002`, etc.;
- existe tentativa de retry em caso de colisão.

Problema:

- a ordenação textual pode se comportar mal quando a base crescer, principalmente em números com diferentes quantidades de dígitos;
- em concorrência, duas criações simultâneas ainda podem disputar o mesmo código;
- retry reduz o problema, mas não elimina a causa raiz.

Recomendação:

- usar sequência numérica no banco ou tabela específica de contador;
- ou separar um campo numérico interno para ordenação e montar o código apenas na saída;
- manter `codigo` único, mas parar de depender de `orderBy` textual para gerar o próximo valor.

### 6.3 Métricas de ponto não consideram corretamente folgas configuradas e podem distorcer faltas/presença

Local principal: `apps/api/src/services/ponto.service.ts`

Status atual:

- o sistema possui `FolgaConfig` e rotas para configurar folgas;
- porém as métricas agregadas calculam dias úteis basicamente como segunda a sexta;
- o total de faltas e presença não considera a folga individual configurada por funcionário.

Problema:

- relatórios podem apontar falta em dia que é folga válida do colaborador;
- percentual de presença pode ficar incorreto;
- dashboards analíticos podem induzir decisões erradas.

Recomendação:

- recalcular métricas considerando `FolgaConfig` por usuário;
- preparar suporte futuro para feriados oficiais e folgas extraordinárias;
- ajustar exportações para refletirem a mesma regra.

### 6.4 Cálculo de streak pode inflar resultados por não considerar dias sem registro

Local principal: `apps/api/src/services/ponto.service.ts`

Status atual:

- a lógica de `streakAtual` e `maiorStreak` trabalha sobre a lista de pontos existentes;
- dias sem registro podem não quebrar a sequência se não houver um registro explícito de ausência.

Problema:

- o analytics pode mostrar sequências consecutivas maiores do que a realidade;
- isso impacta a confiabilidade do painel administrativo.

Recomendação:

- gerar a linha do tempo completa do período antes de calcular streak;
- considerar dias úteis esperados, folgas e faltas explícitas.

### 6.5 Checklist perde qualidade de auditoria e histórico operacional

Locais principais:

- `apps/api/prisma/schema.prisma`;
- `apps/api/src/services/checklist.service.ts`.

Status atual:

- `ChecklistRegistro` possui `userId`, mas a restrição única atual é `@@unique([itemId, data])`;
- o registro do dia é sobrescrito no toggle;
- ao remarcar o item, o responsável pode ser trocado;
- ao desmarcar, o histórico operacional se perde.

Problema:

- baixa rastreabilidade sobre quem marcou, desmarcou e em qual horário;
- não existe trilha de auditoria real para rotina operacional;
- dificulta investigação de falhas no fechamento diário.

Recomendação:

- manter o status atual consolidado do item, mas criar histórico de eventos separado;
- registrar usuário, ação, data/hora e motivo opcional;
- se o checklist for por setor ou por turno no futuro, remodelar a chave de unicidade.

### 6.6 Exclusão permanente de usuário remove registros do banco, mas pode deixar arquivos físicos órfãos

Local principal: `apps/api/src/services/user.service.ts`

Status atual:

- no `hardDeleteUser`, os registros `Arquivo` e `Arte` são removidos do banco;
- não foi identificada remoção física dos arquivos do disco antes do delete em massa.

Problema:

- risco de lixo de arquivos em `uploads`;
- consumo indevido de armazenamento;
- perda de rastreabilidade entre banco e filesystem.

Recomendação:

- antes do delete em massa, listar caminhos físicos dos arquivos e removê-los do storage;
- idealmente encapsular esta rotina em um serviço único de gerenciamento de anexos.

### 6.7 Sessões e refresh token com governança fraca

Locais principais:

- `apps/api/src/services/auth.service.ts`;
- `apps/api/src/controllers/auth.controller.ts`.

Status atual:

- access token e refresh token são gerados via JWT;
- refresh token não é persistido em banco;
- logout é apenas lógico no frontend.

Problema:

- não há revogação real de refresh token;
- não há controle de sessões por dispositivo;
- logout não invalida credenciais emitidas anteriormente.

Recomendação:

- persistir refresh tokens ou session tokens em banco;
- implementar revogação por logout e por troca de senha;
- opcionalmente registrar metadados de sessão.

### 6.8 Ferramentas de qualidade incompletas no frontend

Locais principais:

- `apps/web/package.json`;
- ausência de suíte de testes no repositório.

Status atual:

- existe script `lint`, mas o pacote `eslint` não aparece declarado no `apps/web/package.json` analisado;
- não há suíte de testes automatizados identificada no monorepo.

Problema:

- manutenção mais arriscada;
- baixa proteção contra regressões;
- dificuldade de validar refactors e novas regras de negócio.

Recomendação:

- instalar e configurar `eslint` oficialmente no frontend;
- criar testes mínimos por camada:
  - backend: services críticos;
  - frontend: hooks e componentes mais sensíveis;
  - smoke tests dos principais fluxos.

## 7. Features novas úteis para o dia a dia da gráfica

Abaixo está um backlog funcional recomendado com foco operacional.

### 7.1 Prioridade alta

#### a) Medidas e cálculo operacional em centímetros

- cadastro e edição em centímetros;
- cálculo automático de área em cm² e m²;
- possibilidade de conversão visual entre unidades;
- base pronta para precificação por área.

#### b) Fila de produção por etapa

Evolução do módulo de artes para refletir o fluxo real da gráfica:

- arte;
- aprovação do cliente;
- impressão;
- acabamento;
- entrega/retirada.

Benefício:

- melhora a visão do gargalo diário;
- reduz perda de prazo;
- aproxima o sistema da operação real.

#### c) Alertas operacionais automáticos

- prazo de arte vencendo;
- arte parada há muitos dias;
- checklist diário incompleto após horário limite;
- funcionário sem bater ponto até certo horário.

Benefício:

- reduz dependência de conferência manual.

#### d) Cadastro de clientes e histórico por cliente

Hoje os dados do cliente parecem ficar vinculados diretamente à arte.

Sugestão:

- criar entidade `Cliente`;
- manter histórico de artes por cliente;
- facilitar reimpressões, recorrência e atendimento.

### 7.2 Prioridade média

#### a) Aprovação de arte com histórico

- registrar versão enviada ao cliente;
- status de aprovado, reprovado, aguardando retorno;
- data/hora da aprovação;
- observação de alteração solicitada.

#### b) Dashboard de produção do dia

- quantas artes estão em cada etapa;
- quantas urgentes estão abertas;
- quais vencem hoje;
- checklist diário pendente;
- colaboradores com ponto incompleto.

#### c) Relatórios por responsável e por produto

- tempo médio por tipo de produto;
- volume por responsável;
- taxa de retrabalho;
- quantidade entregue no prazo.

#### d) Calendário operacional

- feriados;
- folgas especiais;
- picos de produção;
- prazos concentrados.

### 7.3 Prioridade estratégica

#### a) Precificação e orçamento assistido

- cálculo por área, material e acabamento;
- geração de orçamento interno;
- comparação entre custo e preço praticado.

#### b) Controle de retrabalho

- motivo do retrabalho;
- etapa onde ocorreu;
- custo estimado;
- reincidência por produto ou operador.

#### c) Painel de expedição / entrega

- pedido pronto;
- aguardando retirada;
- entregue;
- observações logísticas.

## 8. Recomendação técnica para a próxima atualização

### 8.1 Tema central recomendado

A próxima atualização deve priorizar padronização de dados e confiabilidade operacional, com foco em três frentes:

1. correção estrutural das medidas das artes para centímetros;
2. revisão das métricas e auditoria dos módulos de ponto e checklist;
3. fortalecimento da base técnica com lint, testes e melhor governança de sessão.

### 8.2 Ordem sugerida de execução

#### Fase 1 — Correções de base

- migrar medidas de arte para centímetros;
- corrigir geração de código de arte;
- corrigir cálculo de métricas considerando folgas;
- corrigir exclusão física de arquivos em hard delete.

#### Fase 2 — Confiabilidade e auditoria

- melhorar trilha de auditoria do checklist;
- revisar cálculo de streak e indicadores de ponto;
- implementar gestão real de refresh token/sessão.

#### Fase 3 — Ganho operacional

- fila de produção por etapa;
- dashboard operacional do dia;
- alertas automáticos;
- cadastro estruturado de clientes.

## 9. Mudança específica solicitada: metros para centímetros

### Decisão recomendada

Alterar o cadastro das artes para trabalhar oficialmente em centímetros.

### Justificativa

- é mais coerente com a rotina da gráfica;
- reduz ambiguidade no cadastro;
- melhora entendimento para equipe operacional;
- simplifica conferência com medidas reais de produção;
- cria base melhor para cálculos e orçamentos futuros.

### Implementação recomendada

#### Opção ideal

Trocar:

- `largura` -> `larguraCm`
- `altura` -> `alturaCm`

Com tipo inteiro.

#### Migração de dados

- registros atuais em metros devem ser convertidos para centímetros;
- exemplo: `1.5` metros -> `150` centímetros.

#### Itens que precisam ser alterados

- `apps/api/prisma/schema.prisma`;
- controllers e services de artes;
- seed do Prisma;
- tipos compartilhados do frontend;
- formulários e cards da tela `Artes`;
- relatórios e futuras exportações que exibirem medida.

### Observação importante

Se houver dados legados inseridos com interpretação inconsistente, será necessário validar amostras reais antes da migração final para evitar converter valores já cadastrados em centímetros por engano.

## 10. Conclusão executiva

O GraficaOS já possui uma base funcional boa e cobre rotinas importantes da gráfica, principalmente ponto, artes e checklist. A próxima atualização deve focar menos em adicionar telas isoladas e mais em consolidar a qualidade do dado e a aderência ao processo real da operação.

Hoje, a principal correção de negócio é a troca da unidade das artes para centímetros. Em paralelo, existem correções estruturais importantes em geração de código, métricas de ponto, auditoria do checklist, sessão/autenticação e limpeza de arquivos órfãos.

Se essas correções forem tratadas primeiro, o sistema fica muito mais confiável para receber novas features operacionais no próximo ciclo.
