# SUPORTE TELEQUIPE — V6 (Cadastro Mestre de Colaboradores)

Plataforma de inteligência operacional para equipes técnicas de telecom Nokia. Acesso livre (sem login). Persistência em **PostgreSQL via Prisma ORM**.

A **V6** é uma reestruturação corporativa: os conceitos de **Líder**, **Instalador** e **Equipe** foram completamente removidos. O sistema passou a ter uma única entidade central de pessoas — **Colaborador** (Cadastro Mestre) — alimentada por um único arquivo Excel oficial via **Importação Massiva (Smart Sync)**: insere quem é novo, atualiza quem já existe e marca como "inativo" (nunca exclui) quem não aparece mais na planilha, preservando 100% do histórico de atendimentos e avaliações.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (local, Railway ou qualquer provedor compatível)
- `xlsx` (SheetJS) para parsing de planilhas Excel

## V6 — Cadastro Mestre de Colaboradores (Smart Sync)

Substitui por completo o módulo de Líderes/Equipes/Importação de Equipe das versões V3–V5.

- **`prisma/schema.prisma`**: os models `Leader` e `Equipe` foram removidos. `Colaborador` passou a ter `tipoPessoa`, `regional`, `operadoras`, `empresaNome`, `cargo`, `telefone`, `status`, `dataImportacao`, `ultimaAtualizacao`, além de `nomeNormalizado` (`String? @unique`) — chave natural de deduplicação (ver V6.1 abaixo). `SupportTicket` passou a ter `colaboradorId` (cada atendimento pertence a um único colaborador) no lugar de `liderId`/`equipeId`; os atendimentos registrados antes da V6 preservam o nome do líder/equipe da época em `liderNomeHistorico`/`equipeNomeHistorico` (texto solto, sem FK — as tabelas de origem não existem mais).
- **`lib/colaboradores.ts`**: motor de importação/Smart Sync. Localiza a tabela de colaboradores pelo conteúdo das células (Nome, TipoPessoa, Regional, Cadastro, EmpresaNome, Cargo, Telefone), normaliza os dados, identifica cada pessoa pelo **nome normalizado** e sincroniza em lote dentro de uma transação: `createMany` para novos, updates individuais para quem mudou, `updateMany` para inativar quem sumiu da planilha.
- **`app/colaboradores/actions.ts`**: `analisarPlanilhaColaboradores` (parsing + comparação, não grava nada) e `confirmarSincronizacao` (grava a sincronização e devolve o relatório: novos/atualizados/mantidos/inativados/erros/tempo de processamento). CRUD manual (`createColaborador`/`updateColaborador`/`deleteColaborador`) mantido para correções pontuais fora do Excel.
- **`/colaboradores`**: Cadastro Mestre — pesquisa instantânea, filtros avançados (TipoPessoa, Regional, Empresa, Cargo, Status), ordenação, paginação, cards de indicadores/totalizadores.
- **`/colaboradores/[id]`**: histórico individual do colaborador (quantidade de atendimentos, último atendimento, tempo desde o último, lista completa).
- **`/importacao`**: fluxo de Importação Massiva (`ImportadorColaboradores.tsx`) — selecionar arquivo → validar → pré-visualizar (Smart Sync) → confirmar → relatório final.
- As rotas antigas `/lideres` e `/equipes` (e suas variantes `[id]`) foram desativadas e redirecionam para `/colaboradores`; os arquivos correspondentes não puderam ser fisicamente apagados durante a migração (ambiente sem acesso a shell) e foram esvaziados/neutralizados — podem ser removidos manualmente quando conveniente.
- **Decisão de arquitetura confirmada com o usuário**: o Cadastro Mestre começou vazio nesta migração (líderes/colaboradores/equipes cadastrados antes da V6 não foram migrados automaticamente); os agrupamentos "IMT por Líder"/"IMT por Equipe" foram removidos (mantido apenas "IMT por Colaborador").

### V6.1 — Ajuste pós-análise da planilha real

Após inspecionar o arquivo oficial `BASE_COLABORADORES_INICIAL_2026.xlsx`, dois pontos exigiram correção em relação ao desenho original da V6:

- A coluna **"Cadastro"** não é uma matrícula/ID único — na prática lista as operadoras/clientes atendidos pelo colaborador (ex.: `"ERICSSON/NOKIA"`), repete entre pessoas diferentes e frequentemente vem vazia. Ela foi renomeada no schema para **`operadoras`** e deixou de ser usada como chave de identificação.
- A chave natural de deduplicação do Smart Sync passou a ser **`nomeNormalizado`** (nome em maiúsculas, sem acento, espaços colapsados) — calculada automaticamente a partir de `nome` a cada import/edição. Colaboradores homônimos na mesma planilha são sinalizados como erro e exigem ajuste manual (ex.: incluir sobrenome completo) para diferenciação.
- Em parte das linhas, `EmpresaNome` vinha preenchido com "nome da pessoa + número de documento (tipo CPF)" em vez do nome da empresa — típico de colaboradores autônomos sem empresa formal. `lib/colaboradores.ts` detecta esse padrão e remove o número automaticamente (nunca é gravado no banco).
- Migration `20260707020000_operadoras_e_nome_normalizado`: renomeia a coluna, remove a unicidade antiga e cria `nomeNormalizado` com backfill.

### V6.2 — Controle de acesso (edição x visualização)

Qualquer pessoa com o link visualiza o sistema livremente, sem login. Ações de escrita (criar, editar, excluir, alternar status, importar) exigem que o **modo de edição** esteja destravado — feito na barra lateral, informando a senha em `EDIT_PASSWORD`.

- **`lib/auth.ts`**: `senhaCorreta()` compara com `EDIT_PASSWORD` (comparação em tempo constante); `criarTokenSessao()`/`estaEmModoEdicao()` geram/validam um cookie httpOnly assinado com HMAC-SHA256 (`AUTH_SECRET`), válido por 30 dias; `garantirModoEdicao()` lança erro se chamado sem o modo de edição ativo.
- **`app/auth/actions.ts`**: `desbloquearEdicao` (valida a senha e grava o cookie) e `bloquearEdicao` (remove o cookie).
- **`components/EditModeControl.tsx`**: widget na barra lateral — mostra "Modo de edição ativo" com botão "Bloquear", ou um campo de senha para destravar.
- Toda Server Action que escreve no banco chama `garantirModoEdicao()` como primeira linha (defesa em profundidade, independente da UI). Cada página esconde os formulários/botões de criar, editar e excluir quando o modo de edição não está ativo (`estaEmModoEdicao()` lido diretamente nos Server Components).
- Variáveis obrigatórias em produção: `EDIT_PASSWORD` (a senha) e `AUTH_SECRET` (string aleatória para assinar o cookie — gere com `openssl rand -hex 32`). Sem elas, o modo de edição não pode ser destravado.

## O que mudou na V3

## O que mudou na V3

- Removido: `better-sqlite3`, `lib/db.ts`, `lib/seed.ts`, arquivo `data/*.db`.
- Adicionado: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `lib/prisma.ts`.
- Todas as Server Actions e páginas passaram a usar `PrismaClient` (async) em vez de SQL cru com `better-sqlite3` (síncrono). A regra de negócio (gargalo, ranking, tendência, alertas, sugestões de treinamento) foi 100% preservada em `lib/imt.ts`, apenas portada para consultas Prisma assíncronas.
- Modelagem: `Leader`, `Equipe`, `Colaborador`, `CompetenciaNokia`, `AvaliacaoCompetencia`, `Treinamento` — mais `TreinamentoColaborador` (tabela de junção necessária para preservar a contagem de participantes por treinamento e a criação de treinamentos já vinculados a um colaborador nas sugestões automáticas).
- IDs mantidos como `Int` autoincremento (em vez de `String`/`cuid`) para preservar 100% da lógica existente de Server Actions, que já trabalha com `Number(formData.get("id"))` em toda a aplicação.
- Campos extras do V2 (cargo, regional, telefone, email, status, dataAdmissao, categoria, cargaHoraria, instrutor, nivel) foram mantidos no schema além da lista literal do briefing, para que nenhuma tela perca funcionalidade. Um campo novo (`Treinamento.descricao`) foi adicionado ao schema conforme pedido, mas ainda não tem campo correspondente no formulário — ver "Próximas recomendações".

## V4 — Central de Suporte Técnico

Novo módulo, totalmente aditivo: nenhuma tela existente (Dashboard, Matriz Nokia, Líderes, Equipes, Colaboradores, Treinamentos) teve sua funcionalidade ou identidade visual alterada.

- **Model `SupportTicket`** (`support_tickets`): registra cada atendimento (data, hora início/fim, tempo calculado automaticamente em minutos, líder, equipe, projeto, cliente, tipo de atendimento, categoria, descrição do problema, solução aplicada, resultado, status, observações, técnico responsável). Relacionamento 1:N a partir de `Leader` e `Equipe` (ambos opcionais, `onDelete: SetNull`).
- **`lib/suporte.ts`**: constantes de domínio (tipos de atendimento, categorias, resultados, status), cálculo automático de tempo de atendimento, KPIs (atendimentos hoje/mês, tempo médio, resolvidos hoje, pendentes) e indicadores automáticos (por líder, por equipe, por projeto, tempo médio por categoria, top categorias/equipes/líderes, % resolvido na primeira intervenção, pendências abertas).
- **`/suporte`**: tela principal — KPIs, filtros (período, líder, equipe, projeto, categoria, status, técnico), busca livre, listagem completa e cards de indicadores (últimos atendimentos, top categorias/equipes/líderes).
- **`/suporte/novo`**: formulário completo de abertura de atendimento, com cálculo automático (client-side, para feedback imediato) do tempo entre hora início/término.
- **`/suporte/[id]`**: detalhes do atendimento, edição completa, encerramento rápido (`status = Finalizado`) e exclusão.
- **`/relatorios/suporte`**: relatório filtrado (período, projeto, equipe, líder, cliente, resultado) com KPIs agregados. Botões de exportação Excel/PDF já estruturados na tela, propositalmente desabilitados — ver "Próximas recomendações".
- **`/lideres/[id]`** e **`/equipes/[id]`** (novas rotas): tela de detalhe com aba/seção "Histórico de Suporte", listando todos os atendimentos vinculados àquele líder/equipe. Um link "Ver histórico" foi adicionado à listagem de `/lideres` e `/equipes` para acessá-las — única alteração nessas duas telas, o cadastro/remoção existentes continuam idênticos.
- **Sidebar**: item "Suporte Técnico" adicionado apontando para `/suporte`, sem alterar os itens existentes.
- A camada de indicadores foi desenhada para futuramente alimentar uma IA operacional (perguntas como "qual equipe gera mais suporte?", "qual categoria tem maior incidência?") — os dados já existem prontos em `getIndicadoresSuporte()`.

## Pré-requisitos

- Node.js 18 ou superior
- Um banco PostgreSQL acessível (local, Docker ou Railway)
- Conexão com a internet para `npm install` e `prisma generate`

## Como rodar localmente

```bash
# 1. Configurar variável de ambiente
cp .env.example .env
# edite .env com a DATABASE_URL do seu Postgres

# 2. Instalar dependências (roda "prisma generate" automaticamente via postinstall)
npm install

# 3. Aplicar a migração inicial no banco
npx prisma migrate deploy
# (em desenvolvimento, "npm run migrate" == "prisma migrate dev" também funciona)

# 4. (Opcional) Popular o banco com dados de exemplo
npm run seed

# 5. Rodar em modo desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** — a rota raiz redireciona para `/home`.

> A migração inicial em `prisma/migrations/20260706120000_init/migration.sql` foi escrita manualmente a partir do `schema.prisma` (gerar via `prisma migrate dev` exige conexão ativa com um banco, indisponível no ambiente onde este projeto foi preparado). Recomendação: na primeira vez que for rodar contra um banco real, rode `npx prisma migrate dev --name init` — se o schema já bater (deve bater), o Prisma apenas registra a migração como aplicada; caso prefira, apague a pasta da migração e deixe o Prisma gerar a dele do zero.

> **V4:** o model `SupportTicket` foi adicionado a `schema.prisma`, mas a migração correspondente ainda não foi gerada (requer conexão com o banco real). Rode `npx prisma migrate dev --name add_support_tickets` para gerá-la e aplicá-la — o Prisma detecta o diff automaticamente.

> **V6:** migração `prisma/migrations/20260707000000_colaborador_mestre/migration.sql` escrita manualmente (mesmo motivo — sem conexão de banco no ambiente onde foi preparada). Ela remove as tabelas `leaders`/`equipes`, reestrutura `colaboradores` e liga `support_tickets.colaboradorId`, preservando o nome do líder/equipe de atendimentos antigos em colunas de texto antes de derrubar as tabelas de origem. Rode `npx prisma migrate deploy` para aplicá-la a um banco já existente (V3–V5). Se for um banco novo, `npx prisma migrate deploy` aplica todo o histórico de migrações em sequência.

## Deploy

### Railway
1. Crie um projeto, adicione o plugin **PostgreSQL**.
2. Copie a `DATABASE_URL` gerada em Postgres → Variables.
3. No serviço da aplicação, defina `DATABASE_URL` como variável de ambiente.
4. Build command: `npm install && npm run build` (o `postinstall` já roda `prisma generate`).
5. Antes do primeiro deploy (ou via um "Release Command"), rode `npx prisma migrate deploy`.

### Vercel
1. Defina `DATABASE_URL` em Project Settings → Environment Variables.
2. Se o Postgres estiver atrás de um pooler (PgBouncer, Prisma Accelerate, Supabase pooler, etc.), configure também `DIRECT_URL` com a conexão direta e adicione `directUrl = env("DIRECT_URL")` no `datasource db` do `schema.prisma` — migrations não funcionam através de um pooler.
3. Rode `npx prisma migrate deploy` a partir de uma máquina com acesso à `DIRECT_URL` (Vercel não expõe um passo de release nativo; use um workflow de CI ou rode manualmente antes do primeiro deploy).

## Estrutura de páginas

| Rota | Descrição |
|---|---|
| `/home` | Dashboard inteligente: indicadores do Cadastro Mestre, IMT geral e por colaborador, tendência, alertas automáticos |
| `/colaboradores` | **V6:** Cadastro Mestre de Colaboradores — pesquisa, filtros, paginação, indicadores |
| `/colaboradores/[id]` | **V6:** detalhe do colaborador com histórico de atendimentos |
| `/matriz-nokia` | Avaliação por etapa Nokia (MOS, XML, TX, SWAP, FAM, REVERSA) + gargalo por colaborador |
| `/treinamentos` | Registro de treinamentos e certificações |
| `/insights-operacionais` | Gargalo operacional, ranking inteligente, tendência e sugestões automáticas de treinamento |
| `/suporte` | Central de Suporte Técnico — KPIs, filtros, busca, listagem e indicadores (atendimento individual por colaborador desde a V6) |
| `/suporte/novo` | Formulário completo de abertura de atendimento |
| `/suporte/[id]` | Detalhes, edição e encerramento de um atendimento |
| `/relatorios/suporte` | Relatório filtrado de atendimentos (exportação Excel/PDF estruturada, não implementada) |
| `/importacao` | **V6:** Importação Massiva de Colaboradores (Smart Sync) — antes era importação de equipe (líder + instaladores) |
| `/lideres`, `/equipes` | **Desativadas na V6** — redirecionam para `/colaboradores` |

## Módulos futuros (estrutura preparada, sem implementação)

- `app/indicadores/`
- `app/relatorios/` — agora contém `relatorios/suporte`; demais relatórios seguem futuros.

## Estrutura de pastas

```
suporte-telequipe/
├── prisma/
│   ├── schema.prisma        # Modelagem PostgreSQL
│   ├── migrations/          # Migração inicial (SQL)
│   └── seed.ts               # Dados de exemplo via Prisma Client
├── app/
│   ├── layout.tsx / page.tsx / globals.css
│   ├── home/page.tsx                       # Dashboard inteligente
│   ├── colaboradores/                              # V6: Cadastro Mestre de Colaboradores
│   │   ├── page.tsx                                #   Listagem, busca, filtros, paginação
│   │   ├── actions.ts                              #   Smart Sync + CRUD manual
│   │   ├── FiltrosColaboradores.tsx                #   Barra de filtros (client)
│   │   └── [id]/page.tsx                           #   Histórico individual
│   ├── matriz-nokia/{page.tsx,actions.ts}          # Avaliação por etapa + gargalo
│   ├── treinamentos/{page.tsx,actions.ts}
│   ├── insights-operacionais/{page.tsx,actions.ts} # Gargalo, ranking, tendência, sugestões
│   ├── suporte/                                    # Central de Suporte Técnico (atendimento por colaborador desde a V6)
│   │   ├── page.tsx                                #   KPIs, filtros, busca, listagem
│   │   ├── actions.ts                              #   createTicket, updateTicket, closeTicket, deleteTicket
│   │   ├── novo/page.tsx                           #   Formulário completo de abertura
│   │   └── [id]/page.tsx                           #   Detalhes, edição, encerramento
│   ├── importacao/                                 # V6: Importação Massiva (Smart Sync)
│   │   ├── page.tsx
│   │   └── ImportadorColaboradores.tsx
│   ├── lideres/, equipes/    # Desativadas na V6 (redirecionam para /colaboradores)
│   ├── indicadores/          # módulo futuro (vazio)
│   └── relatorios/
│       └── suporte/page.tsx  # Relatório filtrado de suporte
├── components/                # Sidebar, PageHeader, StatCard, EmptyState, TrendBadge, ScoreBar, TempoAtendimentoInputs
├── lib/
│   ├── prisma.ts              # Cliente Prisma singleton
│   ├── imt.ts                 # Motor de inteligência operacional (gargalo, ranking, tendência, alertas)
│   ├── suporte.ts             # KPIs e indicadores da Central de Suporte Técnico
│   └── colaboradores.ts       # V6: motor de importação/Smart Sync do Cadastro Mestre
└── .env.example
```

## Observações

- Sem autenticação: qualquer pessoa com acesso à URL pode usar o sistema.
- Cadastro/remoção usa Server Actions do Next.js (sem API REST separada).
- Nenhuma dependência de gráficos: tendência e IMT são exibidos com badges e barras simples em Tailwind.
