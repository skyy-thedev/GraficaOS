# Manual do Usuário — Administrador

Data de referência: 13/05/2026
Perfil-alvo: `ADMIN`
Sistema: `GraficaOS`

## 1. Objetivo

Este manual orienta o uso do GraficaOS pelo perfil administrativo.

O administrador utiliza o sistema para:

- acompanhar a operação da gráfica;
- gerir funcionários e permissões práticas do dia a dia;
- acompanhar e corrigir registros de ponto;
- analisar indicadores de presença e pontualidade;
- organizar produção e prioridades;
- administrar artes, checklist e visão operacional por loja.

---

## 2. Acesso e perfil administrativo

### 2.1 Login

Para acessar:

1. informe e-mail e senha cadastrados;
2. clique em entrar;
3. confirme no layout que o perfil exibido é `Administrador`.

### 2.2 Como confirmar permissões

O administrador possui navegação diferente do funcionário.

Os atalhos principais do admin são:

- `Dashboard`
- `Gestão`
- `Analytics`
- `Agenda`

Além disso, o menu complementar dá acesso a:

- `Artes / Gráfica`
- `Operação`
- `Clientes`
- `Checklist Diário`
- `Funcionários`

Se essas opções não aparecerem, valide o cargo do usuário cadastrado.

---

## 3. Visão geral do menu administrativo

## 3.1 Núcleo principal

### `Dashboard`
Ponto de entrada do sistema para leitura geral.

### `Gestão`
Controle diário dos registros de ponto por colaborador.

### `Analytics`
Leitura gerencial consolidada de presença, pontualidade, ranking e alertas.

### `Agenda`
Planejamento de prazos e carga produtiva.

## 3.2 Complementos administrativos

### `Artes / Gráfica`
Gestão detalhada do fluxo Kanban e cadastro de novas artes.

### `Operação`
Leitura de gargalos, ranking produtivo e distribuição de trabalho.

### `Clientes`
Identificação de clientes recorrentes a partir da base de artes.

### `Checklist Diário`
Configuração e auditoria prática dos itens da rotina.

### `Funcionários`
Cadastro, edição, ativação, desativação e visão de equipe.

---

## 4. Gestão de pontos

A tela `Gestão de Pontos` é o centro do controle diário de jornada da equipe.

### 4.1 O que a tela mostra

A tela apresenta:

- total de registros esperados no escopo filtrado;
- quantidade de registros completos;
- funcionários trabalhando;
- ausentes do dia;
- cards por funcionário com horários do dia;
- status individual do ponto;
- loja de cada colaborador.

### 4.2 Filtros disponíveis

O administrador pode filtrar por:

- data;
- funcionário específico;
- visão consolidada da equipe.

### 4.3 Como interpretar os cards

Cada card mostra:

- nome do funcionário;
- loja;
- data;
- horários de entrada, almoço, retorno e saída;
- horas do dia;
- status atual.

Status comuns:

- `Completo`
- `Trabalhando`
- `Folga`
- `Ausente`
- `Encerrado automaticamente`

### 4.4 Folga x ausência

Nesta versão, o sistema já diferencia corretamente:

- `Folga`: dia configurado como folga do colaborador;
- `Ausente`: dia útil sem entrada registrada.

Isso reduz distorções no controle diário.

### 4.5 Como editar um ponto existente

Para editar:

1. abra `Gestão`;
2. encontre o funcionário e a data desejada;
3. clique em `Editar` no card do registro real;
4. ajuste os horários necessários;
5. salve a alteração.

Observação:

- registros sintéticos de folga ou ausência não são editados diretamente;
- nesses casos, o ajuste deve ser feito criando ou corrigindo o ponto real/manual.

### 4.6 Como lançar ponto manual

Use `Ponto Manual` quando for necessário registrar ou corrigir jornada fora do fluxo automático.

Fluxo recomendado:

1. clique em `Ponto Manual`;
2. selecione o funcionário;
3. informe a data;
4. preencha os horários aplicáveis;
5. selecione o status correto;
6. confirme a criação.

Use esse recurso em casos como:

- esquecimento de batida;
- falha operacional;
- ajuste retroativo autorizado.

### 4.7 Como configurar folgas

Use o botão `Folgas` para definir os dias fixos de folga por colaborador.

Fluxo:

1. abra `Folgas`;
2. selecione o funcionário;
3. marque os dias da semana correspondentes;
4. salve a configuração.

Essas configurações impactam diretamente:

- gestão diária;
- analytics;
- leitura correta de faltas.

### 4.8 Exportação

A tela permite exportar `CSV` do escopo filtrado.

Use esse recurso para:

- auditoria externa;
- conferência com RH;
- compartilhamento interno.

---

## 5. Analytics de ponto

A tela `Analytics` é o painel gerencial do ponto.

### 5.1 Objetivo do módulo

Permite analisar comportamento operacional da equipe por período, com foco em:

- presença;
- pontualidade;
- horas trabalhadas;
- encerramentos automáticos;
- ranking gerencial;
- alertas.

### 5.2 Filtros disponíveis

O módulo aceita:

- presets rápidos de período;
- período customizado com data inicial e final;
- filtro por funcionário.

### 5.3 Indicadores principais

Os cards superiores mostram:

- total de horas;
- percentual de presença;
- percentual de pontualidade;
- número de encerramentos automáticos.

### 5.4 Alertas gerenciais

A seção de alertas resume situações que precisam de atenção, como:

- baixa presença;
- baixa pontualidade;
- excesso de encerramentos automáticos;
- comportamentos fora do esperado no período.

Use essa seção para priorizar ação de gestão, não apenas leitura passiva.

### 5.5 Ranking gerencial por funcionário

O ranking mostra, por colaborador:

- posição no período;
- loja;
- dias presentes versus dias esperados;
- score gerencial;
- presença;
- pontualidade;
- faltas;
- encerramentos automáticos;
- horas totais.

### 5.6 Calendário recente do ranking

Cada card do ranking possui um mini calendário visual do período recente com estados:

- `Presença`
- `Folga`
- `Falta`
- `Fim de semana`

Esse recurso ajuda a identificar padrão rapidamente sem abrir relatórios linha a linha.

### 5.7 Resumo inteligente

A seção de insights resume destaques do período, como:

- melhores desempenhos;
- pontos positivos;
- pontos de atenção;
- métricas que merecem acompanhamento.

### 5.8 Uso recomendado

Analise o módulo em pelo menos três horizontes:

- `Hoje/Semana`: acompanhamento tático;
- `Mês`: gestão corrente;
- `Semestre/Ano`: tendência e histórico.

---

## 6. Agenda de produção

A `Agenda de Produção` é a principal visão de planejamento do admin.

### 6.1 O que a agenda mostra

A tela entrega:

- quantidade de atrasadas;
- vencimentos do dia;
- urgências abertas;
- artes sem prazo;
- janela de produção de `7` ou `14` dias;
- dia selecionado com detalhamento;
- fila priorizada;
- carga por responsável.

### 6.2 Como navegar na agenda

O administrador pode:

- alternar entre `7 dias` e `14 dias`;
- voltar e avançar semanas;
- retornar para `Hoje`;
- selecionar um dia específico da janela.

### 6.3 Filtros da agenda

Filtros disponíveis:

- loja;
- responsável;
- status.

### 6.4 Como usar na prática

Uso recomendado:

1. filtre por loja quando quiser visão separada;
2. observe os dias com mais urgências;
3. abra o dia selecionado para verificar os itens planejados;
4. use a `Fila priorizada` para atacar o que vence primeiro;
5. confira `Carga por responsável` para redistribuir trabalho, se necessário.

### 6.5 Relação com o quadro de artes

A agenda possui atalho para abrir o quadro de artes.

Use esse fluxo quando precisar:

- sair da leitura macro;
- entrar no detalhe operacional;
- atualizar o status do card imediatamente.

---

## 7. Gestão operacional

A tela `Operação` entrega visão gerencial consolidada da produção.

### 7.1 O que a tela mostra

Indicadores principais:

- quantidade de artes em operação;
- entregas concluídas nos últimos 30 dias;
- tempo médio por arte;
- retrabalho em revisão.

### 7.2 Filtro por loja

O admin pode alternar entre:

- visão consolidada;
- `PaperOffice I`;
- `PaperOffice II`.

Esse filtro altera toda a leitura da página.

### 7.3 Ranking operacional por responsável

A seção mostra, por colaborador:

- volume em aberto;
- total concluído;
- urgências resolvidas;
- retrabalho;
- tempo médio;
- score operacional.

Use esse ranking para:

- distribuir demanda;
- avaliar gargalos individuais;
- identificar quem está sobrecarregado;
- entender onde há retrabalho recorrente.

### 7.4 Gargalos imediatos

A seção aponta:

- fila em revisão;
- urgências abertas;
- itens sem prazo definido.

Esses pontos devem orientar o plano do dia da gestão.

### 7.5 Distribuição atual

Mostra a quantidade de artes por estágio:

- `A Fazer`
- `Produção`
- `Revisão`
- `Concluído`

### 7.6 Pontos de atenção

Lista artes críticas, normalmente por:

- urgência alta;
- revisão pendente.

Use essa lista como radar de risco da operação.

---

## 8. Artes / Gráfica

O administrador possui visão completa do módulo de artes.

### 8.1 Capacidades principais

O admin pode:

- criar nova arte;
- editar arte existente;
- visualizar detalhes;
- excluir arte;
- anexar e remover arquivos;
- mover cards no Kanban;
- filtrar por loja, responsável e urgência.

### 8.2 Cadastro de nova arte

No formulário, os principais campos são:

- cliente;
- número do cliente;
- número do orçamento;
- produto;
- quantidade;
- largura em centímetros;
- altura em centímetros;
- responsável;
- urgência;
- prazo;
- observações.

### 8.3 Número de orçamento

O sistema suporta geração automática de `orcamentoNum`.

Ao cadastrar, valide se o número exibido está coerente com o padrão interno.

### 8.4 Medidas em centímetros

As dimensões das artes devem ser registradas em `cm`.

Exemplo correto:

- largura: `120`
- altura: `90`

Isso representa `120×90cm`.

### 8.5 Kanban operacional

As colunas atuais são:

- `A Fazer`
- `Produção`
- `Revisão`
- `Concluído`

O movimento entre colunas deve refletir o estágio real da peça.

### 8.6 Filtros

Filtros úteis para gestão:

- busca por código ou cliente;
- responsável;
- loja;
- urgência.

### 8.7 Cuidados administrativos

- mantenha prazo preenchido sempre que possível;
- evite artes sem responsável definido;
- priorize revisão e urgências com base na agenda;
- não use o quadro apenas como lista: mantenha o status vivo.

---

## 9. Funcionários

A tela `Funcionários` controla o cadastro da equipe.

### 9.1 O que a tela mostra

A página apresenta:

- total de funcionários;
- presentes hoje;
- artes ativas por equipe filtrada;
- ausentes hoje;
- tabela com cargo, loja, status do ponto, artes ativas e data de cadastro.

### 9.2 Filtro por loja

Use o filtro para separar a análise entre:

- todas as lojas;
- `PaperOffice I`;
- `PaperOffice II`.

### 9.3 Como cadastrar funcionário

Fluxo:

1. clique em `Novo Funcionário`;
2. informe nome, e-mail e senha;
3. selecione cargo;
4. selecione loja;
5. defina cor do avatar;
6. salve.

### 9.4 Como editar funcionário

É possível atualizar:

- nome;
- e-mail;
- senha;
- cargo;
- loja;
- status ativo;
- cor do avatar.

### 9.5 Desativar, reativar e excluir

A tela suporta:

- desativação lógica;
- reativação de usuário inativo;
- exclusão definitiva.

Recomendação:

- prefira desativar quando quiser preservar histórico;
- use exclusão definitiva somente com segurança operacional.

---

## 10. Checklist diário

O administrador usa o `Checklist Diário` em dois níveis:

- acompanhamento do dia;
- configuração da rotina.

### 10.1 O que o admin pode fazer

Além de marcar itens, o admin pode:

- criar novo item;
- editar item existente;
- ativar ou desativar item;
- excluir item;
- abrir relatório.

### 10.2 Cadastro de item

Um item de checklist pode conter:

- título;
- descrição;
- horário limite;
- ordem;
- status ativo.

### 10.3 Como usar o relatório

O relatório serve para:

- verificar execução por período;
- acompanhar atrasos;
- auditar disciplina operacional;
- revisar a qualidade da rotina definida.

### 10.4 Boas práticas

- mantenha a lista enxuta e operacional;
- não cadastre itens redundantes;
- defina horário limite apenas quando realmente fizer sentido;
- revise periodicamente o que deixou de fazer parte da rotina.

---

## 11. Clientes recorrentes

A tela `Clientes` ajuda a identificar padrões de repetição de demanda.

Uso recomendado:

- acompanhar clientes com maior recorrência;
- observar frequência de pedidos;
- apoiar decisões comerciais e produtivas;
- cruzar recorrência com volume operacional.

Essa tela é especialmente útil para planejamento comercial e previsão de carga.

---

## 12. Separação por loja

O sistema já trabalha com duas unidades:

- `PaperOffice I`
- `PaperOffice II`

### 12.1 Onde essa separação aparece

A segmentação por loja está refletida em:

- funcionários;
- artes;
- agenda;
- gestão operacional;
- ranking e leituras administrativas associadas.

### 12.2 Como usar corretamente

- filtre por loja para reuniões específicas de unidade;
- use visão consolidada para tomada de decisão geral;
- valide se o colaborador está vinculado à loja correta no cadastro.

---

## 13. Rotina administrativa recomendada

Fluxo sugerido para abertura do dia:

1. entrar no sistema;
2. abrir `Gestão` para verificar presença, folgas e ausências;
3. revisar `Analytics` se houver alertas importantes;
4. abrir `Agenda` para conferir prazos do dia e da janela;
5. usar `Operação` para enxergar gargalos e redistribuição;
6. ajustar `Artes` quando houver mudanças de prioridade;
7. revisar `Checklist Diário` e pendências críticas.

Fluxo sugerido para fechamento do dia:

1. revisar pontos incompletos;
2. corrigir inconsistências manuais autorizadas;
3. validar urgências em aberto;
4. conferir entregas do dia e revisões pendentes;
5. checar se o checklist crítico foi concluído.

---

## 14. Problemas comuns e tratamento

### 14.1 Funcionário aparece ausente, mas era folga

Verifique:

- se a folga foi configurada corretamente no módulo `Gestão`;
- se a data consultada é dia útil;
- se não houve lançamento manual incorreto.

### 14.2 Ponto ficou incompleto

Ação recomendada:

- confirmar com o colaborador o horário real;
- editar ou lançar ponto manual;
- evitar deixar registros críticos sem fechamento.

### 14.3 Produção desorganizada entre lojas

Verifique:

- se o colaborador está com a loja correta no cadastro;
- se os filtros estão aplicados corretamente;
- se o responsável da arte está coerente com a unidade.

### 14.4 Muitas artes sem prazo

Ação recomendada:

- revisar o backlog no módulo `Artes`;
- priorizar definição de prazo mínimo;
- acompanhar impacto na `Agenda` e em `Operação`.

### 14.5 Excesso de revisão ou retrabalho

Use em conjunto:

- `Operação` para localizar gargalo;
- `Agenda` para impacto no prazo;
- `Artes` para atuar no item específico.

---

## 15. Regras de governança recomendadas

- mantenha cadastros de funcionários atualizados;
- configure folgas corretamente antes de cobrar presença;
- use ponto manual somente em correções justificadas;
- trate o analytics como ferramenta de gestão contínua;
- mantenha prazos e responsáveis das artes sempre preenchidos;
- preserve coerência entre realidade da operação e status do sistema.

---

## 16. Encerramento

Para o administrador, o GraficaOS funciona como painel integrado de operação, pessoas e produção.

Os quatro eixos mais importantes do uso administrativo são:

- controle de presença;
- leitura gerencial por indicadores;
- planejamento da produção;
- manutenção disciplinada dos dados operacionais.

Quando bem utilizado, o sistema reduz ruído operacional, melhora previsibilidade e aumenta a confiabilidade da gestão diária.
