# GraficaOS v3.1

Data de referência: 13/05/2026
Status esperado para deploy final: pronto para validação final

## Resumo

A versão 3.1 consolida a reta final do GraficaOS com foco em:

- correções finas de regra de negócio em ponto e analytics;
- padronização visual entre dashboard, agenda, operação e funcionários;
- melhoria de legibilidade em tema escuro;
- responsividade refinada para desktop, tablet e mobile;
- interação visual consistente em cards clicáveis;
- reforço de inteligência operacional com resumos contextuais.

## Ajustes-chave desta versão

### 1. Ponto e analytics mais confiáveis

- correção de falso atraso para jornadas especiais em domingos e feriados;
- filtros de período no analytics alinhados ao mês calendário real;
- alertas gerenciais sincronizados com o período visível na tela.

### 2. UI mais consistente com o dashboard

- redução de exageros de escala em cards da agenda e funcionários;
- reequilíbrio de tipografia, espaçamento e altura visual dos blocos;
- manutenção de padrão visual próximo ao dashboard principal.

### 3. Legibilidade reforçada

- tons de texto secundário ajustados para melhor contraste em fundo escuro;
- números e indicadores-chave revisados para leitura rápida;
- badges e metadados com contraste mais previsível.

### 4. Cards interativos padronizados

Foi criado um comportamento visual reutilizável para cards clicáveis:

- `cursor: pointer`;
- elevação com `transform: translateY(...)`;
- `transition` suave;
- `filter: drop-shadow(...)` com glow branco ou colorido.

Esse padrão foi aplicado principalmente em:

- cards clicáveis do dashboard;
- atalhos rápidos;
- cards de seleção da agenda;
- cards-resumo inteligentes da agenda.

### 5. Agenda mais inteligente

A agenda de produção agora entrega leitura contextual adicional:

- resumo inteligente da janela atual;
- leitura rápida do dia selecionado;
- destaque da próxima entrega relevante;
- identificação do responsável com maior carga na janela.

## Arquivos mais impactados na v3.1

- `apps/web/src/index.css`
- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/pages/AgendaProducao.tsx`
- `apps/web/src/pages/Funcionarios.tsx`
- `apps/web/src/pages/GestaoOperacional.tsx`
- `apps/api/src/services/ponto.service.ts`
- `apps/web/src/pages/PontoAnalytics.tsx`

## Objetivo da v3.1

A v3.1 é a versão de refinamento final antes do deploy, priorizando:

- leitura imediata da informação;
- consistência entre módulos;
- confiança operacional;
- melhor experiência em dispositivos diferentes;
- acabamento visual mais profissional para uso diário.
