# SUPORTE TELEQUIPE — V2

Plataforma de inteligência operacional para equipes técnicas de telecom Nokia. Acesso livre (sem login), banco de dados local em SQLite.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- SQLite via `better-sqlite3` (arquivo local em `data/suporte-telequipe.db`)

## Pré-requisitos

- Node.js 18 ou superior instalado no seu computador
- Conexão com a internet (apenas para o `npm install` inicial)

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. (Opcional) Popular o banco com dados de exemplo (inclui histórico temporal de IMT)
npm run seed

# 3. Rodar em modo desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** — a rota raiz redireciona para `/home`.

O banco SQLite é criado automaticamente na primeira execução em `data/suporte-telequipe.db`. Bancos da V1 (coluna `competencia` na matriz Nokia) são migrados automaticamente para o novo formato por etapa na primeira inicialização.

## Estrutura de páginas

| Rota | Descrição |
|---|---|
| `/home` | Dashboard inteligente: IMT geral e por entidade, tendência, alertas automáticos |
| `/lideres` | Cadastro de líderes/coordenadores |
| `/equipes` | Cadastro de equipes de campo, vinculadas a um líder |
| `/colaboradores` | Cadastro de técnicos, vinculados a uma equipe |
| `/matriz-nokia` | Avaliação por etapa Nokia (MOS, XML, TX, SWAP, FAM, REVERSA) + gargalo por colaborador |
| `/treinamentos` | Registro de treinamentos e certificações |
| `/insights-operacionais` | **Novo:** gargalo operacional, ranking inteligente, tendência e sugestões automáticas de treinamento |

## Módulos futuros (estrutura preparada, sem implementação)

- `app/indicadores/` — indicadores avançados de operação
- `app/relatorios/` — geração de relatórios

## V2 — Inteligência Operacional

Toda a lógica de inteligência fica centralizada em `lib/imt.ts`, derivada exclusivamente do histórico de avaliações da Matriz Nokia (nenhuma tabela extra é necessária — cada avaliação já é um ponto no tempo).

**Motor de gargalo operacional.** Para cada colaborador (e, por agregação, cada equipe e cada líder), calcula-se a média de IMT em cada etapa avaliada (MOS, XML, TX, SWAP, FAM, REVERSA) e identifica-se a etapa com a menor média — o "gargalo" daquela entidade.

**Ranking inteligente.** Colaboradores, equipes e líderes são ordenados por um score que combina 70% de IMT médio e 30% de consistência (100 menos o desvio-padrão dos scores). Isso penaliza quem tem bom IMT médio mas desempenho muito irregular entre etapas.

**Análise temporal / tendência.** Cada avaliação tem uma data. A tendência de um colaborador (ou da operação como um todo) compara a média da metade mais recente das avaliações com a metade mais antiga: diferença > 3 pontos é "subindo", < -3 é "caindo", caso contrário "estável". Com menos de 2 avaliações, a tendência é "indefinido".

**Alertas automáticos.** Sempre que a média de uma etapa fica abaixo de 70% de IMT para um ou mais colaboradores, um alerta aparece no dashboard, agrupado por etapa Nokia.

**Sugestões automáticas de treinamento.** Nas mesmas condições do alerta (IMT de etapa < 70%), o sistema sugere um treinamento de reforço para aquela etapa específica, disponível em `/insights-operacionais`. Um botão "Criar treinamento" grava a sugestão diretamente na tabela `treinamentos`, já vinculada ao colaborador.

O limiar de alerta (70%) e a fórmula de ranking estão centralizados em `lib/imt.ts` e podem ser ajustados em um único lugar.

## Estrutura de pastas

```
suporte-telequipe/
├── app/
│   ├── layout.tsx          # Layout raiz (sidebar + área principal)
│   ├── page.tsx            # Redireciona para /home
│   ├── globals.css
│   ├── home/page.tsx                      # Dashboard inteligente
│   ├── lideres/{page.tsx,actions.ts}
│   ├── equipes/{page.tsx,actions.ts}
│   ├── colaboradores/{page.tsx,actions.ts}
│   ├── matriz-nokia/{page.tsx,actions.ts}         # Avaliação por etapa + gargalo
│   ├── treinamentos/{page.tsx,actions.ts}
│   ├── insights-operacionais/{page.tsx,actions.ts} # Gargalo, ranking, tendência, sugestões
│   ├── indicadores/         # módulo futuro (vazio)
│   └── relatorios/          # módulo futuro (vazio)
├── components/
│   ├── Sidebar.tsx
│   ├── PageHeader.tsx
│   ├── StatCard.tsx
│   ├── EmptyState.tsx
│   ├── TrendBadge.tsx       # Indicador visual de tendência (▲ ▬ ▼)
│   └── ScoreBar.tsx         # Barra de IMT colorida por faixa
├── lib/
│   ├── db.ts                # conexão SQLite + schema + migração V1 -> V2
│   ├── imt.ts                # motor de inteligência operacional (gargalo, ranking, tendência, alertas)
│   └── seed.ts               # dados de exemplo com histórico temporal
└── data/                    # arquivo .db gerado em runtime (git-ignorado)
```

## Observações

- Sem autenticação: qualquer pessoa com acesso à URL pode usar o sistema.
- Cadastro/remoção usa Server Actions do Next.js (sem API REST separada), mantendo a stack simples.
- Nenhuma dependência de gráficos foi adicionada: tendência e IMT são exibidos com badges e barras simples em Tailwind, sem bibliotecas externas de charts.
