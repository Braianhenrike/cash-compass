# CashCompass

Painel financeiro pessoal focado em fluxo de caixa, contas, entradas, side hustle e operacoes com bricks.

O projeto continua em `Vite + React + TypeScript`, com `Supabase` como backend real. Nesta etapa 3 ele passa a ter:

- autenticacao com sessao persistida no navegador
- persistencia real no Supabase
- auditoria leve de acoes importantes
- importacao de planilha Excel com preview antes de gravar
- timeline diaria completa
- sugestao de venda com cenarios e simulacao
- relatorios operacionais
- testes de regra de negocio e testes de tela
- build com code splitting melhorado

## Stack

- `Vite`
- `React 18`
- `TypeScript`
- `Supabase Auth + Postgres`
- `@tanstack/react-query`
- `Tailwind CSS`
- `shadcn/ui`
- `Recharts`
- `xlsx` para importacao de Excel

## O que o sistema faz hoje

- login com e-mail e senha
- sessao persistida no navegador
- dashboard com leitura de caixa, risco e simulacao
- CRUD de contas a pagar
- CRUD de entradas
- CRUD de bricks
- registro de custos extras por brick
- registro de venda de brick
- fluxo de caixa diario
- relatorios de lucro, capital travado, previsto vs realizado e giro
- configuracoes de reserva, moeda, alertas e cenarios
- historico de auditoria
- importacao inicial por planilha Excel

## Estrutura principal

```text
src/
  components/
    app/
    auth/
    layout/
    ui/
  integrations/
    supabase/
  lib/
    importers/
  pages/
  providers/
  services/
  stores/
  test/
  types/
supabase/
  config.toml
  migrations/
```

## Arquitetura

### Frontend

- `src/App.tsx`
  - roteamento
  - code splitting das paginas
  - QueryClient global
- `src/components/layout/AppLayout.tsx`
  - shell autenticado da aplicacao
- `src/pages/*`
  - telas de operacao
- `src/stores/financeStore.tsx`
  - camada de estado remoto com React Query

### Dados e servicos

- `src/services/finance.ts`
  - leitura e escrita principal no Supabase
- `src/services/imports.ts`
  - importacao de planilha
- `src/services/audit.ts`
  - trilha de auditoria
- `src/lib/calculations.ts`
  - regras de negocio, timeline, alertas, simulacoes e relatorios
- `src/lib/importers/excelBudgetImport.ts`
  - parser do template Excel

## Banco de dados

Migrations atuais:

- `supabase/migrations/20260331000100_stage1_cashcompass.sql`
- `supabase/migrations/20260331000200_stage2_cashcompass.sql`
- `supabase/migrations/20260401000100_stage3_cashcompass.sql`
- `supabase/migrations/20260401000200_remove_seed_demo_data.sql`

Tabelas principais:

- `settings`
- `categories`
- `accounts_payable`
- `income_entries`
- `brick_items`
- `brick_costs`
- `scenario_configs`
- `alerts`
- `audit_events`

View criada na etapa 3:

- `monthly_finance_overview`

### Decisao de materializacao

- `daily cash projection`
  - calculada sob demanda no frontend porque o app e de uso individual e a janela e curta.
- `monthly_finance_overview`
  - criada como view SQL porque faz sentido agregar mensalmente para relatorios sem complicar o restante da arquitetura.
- `materialized view`
  - nao foi adotada ainda porque o ganho real neste momento nao justifica a manutencao adicional.

## Regras de negocio principais

- `caixa disponivel`
  - valor em maos hoje
- `caixa projetado`
  - caixa atual + entradas previstas + retornos de brick - contas futuras - aportes planejados
- `capital travado`
  - soma do total investido dos bricks ativos
- `total investido`
  - compra + custos extras
- `lucro bruto`
  - valor vendido - preco de compra
- `lucro liquido`
  - valor vendido - total investido
- `ROI`
  - lucro liquido / total investido
- `lucro por dia`
  - lucro liquido / dias travados
- `necessidade de venda`
  - quanto falta para nao romper reserva minima e nao ficar negativo
- `sugestao de venda`
  - score com liquidez, risco, lucro, urgencia, capital preso e cobertura do caixa
- `brick parado`
  - item acima do limite configurado sem venda confirmada

## Importacao de planilha

Tela:

- `src/pages/ImportsPage.tsx`

Fluxo:

1. enviar arquivo `.xlsx`, `.xls` ou `.csv`
2. informar o ano base
3. gerar pre-visualizacao
4. revisar entradas, contas, aportes e saldos
5. confirmar importacao

O parser espera um template como o da sua planilha atual:

- secoes de entradas acima de `Total de Entradas`
- contas abaixo de `Total de Entradas`
- linha `Investir` para aportes planejados
- linha `SALDO MENSAL`
- linha `SALDO EM DINHEIRO`
- coluna `DATA` com dia de vencimento quando existir

Resultado da importacao:

- linhas de entrada viram registros em `income_entries`
- linhas de conta viram registros em `accounts_payable`
- linha `Investir` vira bricks com status `planned`
- opcionalmente o ultimo `SALDO EM DINHEIRO` atualiza `current_cash_balance`
- a operacao fica registrada em `audit_events`

## Auditoria e rastreabilidade

A trilha leve da etapa 3 registra:

- importacao de planilha
- alteracoes importantes em settings
- create, update e delete de categorias, contas, entradas e bricks
- custos extras de brick
- alteracoes de cenario

## Alertas e resiliencia

- mensagens de erro mais humanas
- tentativa manual de recarregar dados a partir do layout
- estados de vazio e erro para a nova tela de importacao
- parser com preview antes de gravar no banco
- mensagens claras para falha de rede ou sessao invalida

## Performance

A etapa 3 tambem refinou a performance:

- rotas em lazy loading
- `xlsx` carregado por import dinamico
- chunks separados para `charts`, `xlsx`, `supabase`, `react-query` e UI pesada
- custos de bricks carregados apenas para os bricks do usuario
- `React Query` com cache e stale time mais estavel

## Testes

Arquivos principais de teste:

- `src/test/example.test.ts`
- `src/test/excelBudgetImport.test.ts`
- `src/test/imports-page.test.tsx`
- `src/test/login-page.test.tsx`

Cobertura atual:

- regras de negocio
- projecao diaria
- calculo de lucro e ROI
- alertas
- sugestao de venda
- snapshot de relatorios
- fluxo de login
- fluxo de preview + importacao da planilha

## Como rodar localmente

### Requisitos

- `Node.js 20+`
- `npm`
- `Docker Desktop`
- `Supabase CLI`

### 1. Instalar dependencias

```bash
npm install
```

### 2. Subir o Supabase local

```bash
supabase start
```

### 3. Aplicar as migrations e resetar o banco

```bash
supabase db reset
```

### 4. Descobrir URL e anon key local

```bash
supabase status
```

### 5. Preencher o `.env`

Use o arquivo modelo `.env.example`.

Exemplo:

```env
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="SUA_ANON_KEY_LOCAL"
```

### 6. Rodar o frontend

```bash
npm run dev
```

### 7. Primeiro acesso

1. abrir `/login`
2. criar conta com e-mail e senha
3. entrar no painel
4. importar a planilha ou cadastrar seus dados reais

## Deploy

### Frontend no Vercel

1. subir o repositorio
2. conectar no Vercel
3. configurar as variaveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. publicar

### Backend no Supabase

1. criar projeto no Supabase
2. aplicar as migrations
3. habilitar Auth por e-mail/senha
4. confirmar RLS ativa nas tabelas
5. atualizar as variaveis do Vercel com a URL e anon key do projeto

## Checklist de publicacao

1. `npm install`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
5. `supabase db push` ou pipeline equivalente
6. revisar variaveis de ambiente
7. criar conta de producao
8. testar login, dashboard, importacao e relatorios

## Politica de backup e exportacao

Neste momento a politica recomendada e enxuta:

1. backup do banco pelo proprio Supabase
2. exportacao SQL periodica antes de grandes ajustes
3. manter a planilha original como fonte de conferencia historica
4. usar `audit_events` para rastrear importacoes e alteracoes recentes

Se quiser formalizar mais para producao, o proximo passo natural e adicionar exportacao CSV dos relatorios e snapshot mensal do caixa.

## Scripts uteis

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Validacao mais recente

Executado nesta etapa:

- `npm run lint`
- `npm run test`
- `npm run build`

Tudo passou com sucesso.

## Observacao importante

Aqui dentro da sessao eu preparei o projeto e validei frontend, testes e build, mas nao consegui subir o Supabase local porque a `Supabase CLI` nao esta instalada neste ambiente de execucao.

O codigo ficou pronto. Para autenticar e persistir de verdade na sua maquina, ainda falta apenas subir o Supabase local e preencher o `.env` com a `anon key` local.
