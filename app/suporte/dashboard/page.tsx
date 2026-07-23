import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import CardIndicadorExecutivo from "@/components/CardIndicadorExecutivo";
import BarraDistribuicao from "@/components/BarraDistribuicao";
import GraficoEvolucaoDiaria from "@/components/GraficoEvolucaoDiaria";
import SeletorPeriodoDashboard from "@/components/SeletorPeriodoDashboard";
import {
  getIndicadoresExecutivosSuporte,
  montarWhereDashboard,
  montarHrefDrillDown,
  mapearStatusExecutivoParaParametrosSuporte,
  resolverPeriodo,
  obterRegionaisDisponiveis,
  formatarDataHoraBrasil,
  construirQueryStringAtual,
  NAO_CLASSIFICADO,
  SEM_SUBCATEGORIA,
  TECNICO_NAO_INFORMADO,
  REGIONAL_NAO_INFORMADA,
  STATUS_EXECUTIVO_OPCOES,
  PERIODO_PADRAO,
  type FiltrosDashboardExecutivo,
} from "@/lib/dashboardSuporte";
import { formatarTempo } from "@/lib/suporte";
import { obterProjetos, obterCategoriasPrincipais } from "@/lib/categoriasSuporte";
import { RECURSOS, requireAccess, criarFiltroDeAcessoAtendimentos } from "@/lib/autorizacao";

export const dynamic = "force-dynamic";

/**
 * Sprint "v7.2 — Dashboard Executivo de Suporte" — REVISÃO ("Centro de
 * Controle Operacional").
 *
 * Módulo NOVO e independente — não subordinado a /relatorios/suporte (o link
 * de entrada que existia lá foi removido; o ponto de entrada agora é o
 * próprio menu lateral, ver lib/navegacao.ts). Continua sendo uma página
 * puramente de leitura/indicadores: nenhum formulário de escrita, nenhuma
 * Server Action que grave/altere um atendimento — só o `<form method="get">`
 * dos Filtros Globais abaixo, que apenas navega para esta mesma URL com
 * novos query params (mesmo padrão GET+searchParams já usado por /suporte e
 * /relatorios/suporte).
 *
 * ACESSO (Sprint v7.2 — ÚLTIMA REVISÃO): recurso PRÓPRIO,
 * `RECURSOS.dashboardExecutivo` (lib/permissoes.ts), completamente
 * desacoplado de `RECURSOS.relatorios` — que continua existindo e protegendo
 * só /relatorios/suporte. Mesmo acesso de antes (ADMIN + TECNICO, TECNICO
 * restrito aos próprios atendimentos via `criarFiltroDeAcessoAtendimentos`),
 * só a entrada na matriz mudou de nome.
 *
 * ÚLTIMA ATUALIZAÇÃO / ATUALIZAR DASHBOARD (Sprint v7.2 — ÚLTIMA REVISÃO):
 * `agora = new Date()` é calculado uma única vez por requisição (Server
 * Component, sem `useState`/`useEffect` — evita qualquer problema de
 * hidratação) e repassado tanto para `formatarDataHoraBrasil` (texto exibido)
 * quanto para `getIndicadoresExecutivosSuporte` (parâmetro `agora` do KPI de
 * SLA, já existente), garantindo que os dois nunca divirjam. O botão
 * "Atualizar Dashboard" é um link comum para a própria URL, reconstruindo a
 * query string a partir de `searchParams` (preserva literalmente qualquer
 * parâmetro já presente, sem depender de conhecer cada filtro individual) —
 * clicar nele é uma navegação normal (o Next re-renderiza no servidor, com
 * `force-dynamic`), não um `router.refresh()` nem polling.
 *
 * FILTROS GLOBAIS: um único `<form method="get" action="/suporte/dashboard">`
 * com Projeto/Categoria/Status/Regional/Técnico/Período. Qualquer combinação
 * recalcula TODOS os indicadores da página, porque todos eles vêm de uma
 * única chamada a `getIndicadoresExecutivosSuporte(where)`, com `where` já
 * combinando o escopo de acesso do usuário e os filtros atuais (ver
 * `montarWhereDashboard` em lib/dashboardSuporte.ts).
 *
 * DRILL DOWN: cada card/barra/ponto do gráfico que representa uma dimensão
 * classificável (Projeto, Categoria, Status, Regional, Técnico, Subcategoria,
 * dia da evolução) é um link para `/suporte` já filtrado — combinando os
 * Filtros Globais ativos no momento do clique (`baseDrillDown` abaixo) com a
 * dimensão específica clicada (`montarHrefDrillDown`). Os 4 KPIs
 * Operacionais (Tempo Médio de Atendimento/Resolução, Atrasados, Dentro do
 * SLA) NÃO são clicáveis: são agregados estatísticos, não dimensões de
 * classificação — não existe um filtro equivalente de "tempo"/"atraso" em
 * /suporte, e criar um exigiria uma comparação relativa a "agora" que o
 * modelo de filtros daquela página (já homologado) não supporta hoje. Ver
 * item 6 do relatório de entrega para o detalhamento desta exceção.
 */

// Exibe só os últimos N dias com atendimento no gráfico de evolução, mesmo
// que a agregação cubra todo o período em escopo — mantém o gráfico legível.
const DIAS_EXIBIDOS_EVOLUCAO = 30;

type SearchParams = { [key: string]: string | string[] | undefined };

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function DashboardExecutivoSuportePage({ searchParams }: { searchParams: SearchParams }) {
  const usuario = await requireAccess(RECURSOS.dashboardExecutivo);
  const ehAdmin = usuario.perfil === "ADMIN";
  const escopo = criarFiltroDeAcessoAtendimentos(usuario);

  const filtros: FiltrosDashboardExecutivo = {
    projeto: primeiro(searchParams.projeto) || undefined,
    categoria: primeiro(searchParams.categoria) || undefined,
    statusExecutivo: primeiro(searchParams.status) || undefined,
    regional: primeiro(searchParams.regional) || undefined,
    // Filtro "Técnico" é exclusivo do ADMIN, mesmo critério já usado pelo
    // filtro homônimo de /suporte (ver filtrosPermitidosParaPerfil em
    // lib/autorizacao.ts) — um TECNICO só vê os próprios atendimentos de
    // qualquer forma, então filtrar "por técnico" não faz sentido para ele.
    tecnico: ehAdmin ? primeiro(searchParams.tecnico) || undefined : undefined,
    periodo: primeiro(searchParams.periodo) || PERIODO_PADRAO,
    dataInicioPersonalizada: primeiro(searchParams.data_inicio_personalizada) || undefined,
    dataFimPersonalizada: primeiro(searchParams.data_fim_personalizada) || undefined,
  };

  const where = montarWhereDashboard(escopo, filtros);

  // Um único instante para toda a requisição — ver nota "ÚLTIMA ATUALIZAÇÃO /
  // ATUALIZAR DASHBOARD" no topo do arquivo.
  const agora = new Date();
  const ultimaAtualizacao = formatarDataHoraBrasil(agora);
  const queryStringAtual = construirQueryStringAtual(searchParams);
  const hrefAtualizar = queryStringAtual ? `/suporte/dashboard?${queryStringAtual}` : "/suporte/dashboard";

  const [dados, regionaisDisponiveis] = await Promise.all([
    getIndicadoresExecutivosSuporte(where, agora),
    obterRegionaisDisponiveis(),
  ]);

  const projetosOficiais = obterProjetos();
  const categoriasOficiais = obterCategoriasPrincipais(projetosOficiais[0] ?? null);

  const evolucaoExibida = dados.evolucaoDiaria.slice(-DIAS_EXIBIDOS_EVOLUCAO);

  // Filtros Globais atualmente ativos, traduzidos para os nomes de parâmetro
  // que /suporte (listagem) já entende — base de todo link de drill-down.
  const { dataInicio: dataInicioResolvida, dataFim: dataFimResolvida } = resolverPeriodo(
    filtros.periodo,
    filtros.dataInicioPersonalizada,
    filtros.dataFimPersonalizada
  );
  const baseDrillDown: Record<string, string | undefined> = {
    data_inicio: dataInicioResolvida,
    data_fim: dataFimResolvida,
    categoria_projeto: filtros.projeto,
    categoria_principal: filtros.categoria,
    tecnico: filtros.tecnico,
    regional: filtros.regional,
    ...mapearStatusExecutivoParaParametrosSuporte(filtros.statusExecutivo),
  };

  return (
    <div>
      <PageHeader
        title="Dashboard Executivo"
        description="Centro de controle operacional da Central de Suporte Técnico — indicadores, gráficos e rankings recalculados a cada filtro."
        action={
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">Última atualização</p>
              <p className="text-sm font-semibold tabular-nums text-graphite-100">{ultimaAtualizacao}</p>
            </div>
            <Link href={hrefAtualizar} className="btn-secondary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Atualizar Dashboard
            </Link>
          </div>
        }
      />

      {!ehAdmin && (
        <p className="mb-4 -mt-2 text-xs text-graphite-500">Indicadores calculados somente sobre os seus atendimentos.</p>
      )}

      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-white">Filtros Globais</h2>
        <form
          action="/suporte/dashboard"
          method="get"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="label-field">Projeto</label>
            <select name="projeto" defaultValue={filtros.projeto ?? ""} className="input-field">
              <option value="">Todos</option>
              {projetosOficiais.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Categoria</label>
            <select name="categoria" defaultValue={filtros.categoria ?? ""} className="input-field">
              <option value="">Todas</option>
              {categoriasOficiais.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Status</label>
            <select name="status" defaultValue={filtros.statusExecutivo ?? ""} className="input-field">
              <option value="">Todos</option>
              {STATUS_EXECUTIVO_OPCOES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Regional</label>
            <select name="regional" defaultValue={filtros.regional ?? ""} className="input-field">
              <option value="">Todas</option>
              {regionaisDisponiveis.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {ehAdmin && (
            <div>
              <label className="label-field">Técnico</label>
              <input name="tecnico" defaultValue={filtros.tecnico} className="input-field" placeholder="Nome do técnico" />
            </div>
          )}
          <SeletorPeriodoDashboard
            periodoDefault={filtros.periodo ?? PERIODO_PADRAO}
            dataInicioDefault={filtros.dataInicioPersonalizada}
            dataFimDefault={filtros.dataFimPersonalizada}
          />
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary w-full">Aplicar filtros</button>
            <Link href="/suporte/dashboard" className="btn-secondary w-full text-center">Limpar</Link>
          </div>
        </form>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-graphite-500">Cards Executivos</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CardIndicadorExecutivo
          titulo="Total de Chamados"
          valor={dados.totalChamados}
          accent="brand"
          icone="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          href={montarHrefDrillDown(baseDrillDown)}
        />
        <CardIndicadorExecutivo
          titulo="Chamados Abertos"
          valor={dados.emAberto}
          accent="red"
          icone="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          href={montarHrefDrillDown(baseDrillDown, mapearStatusExecutivoParaParametrosSuporte("Aberto"))}
        />
        <CardIndicadorExecutivo
          titulo="Em Atendimento"
          valor={dados.emAtendimento}
          accent="amber"
          icone="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          href={montarHrefDrillDown(baseDrillDown, mapearStatusExecutivoParaParametrosSuporte("Em Atendimento"))}
        />
        <CardIndicadorExecutivo
          titulo="Concluídos"
          valor={dados.concluidos}
          accent="green"
          icone="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          href={montarHrefDrillDown(baseDrillDown, mapearStatusExecutivoParaParametrosSuporte("Concluído"))}
        />
        <CardIndicadorExecutivo
          titulo="Cancelados"
          valor={dados.cancelados}
          accent="red"
          icone="M15 9l-6 6m0-6l6 6m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          href={montarHrefDrillDown(baseDrillDown, mapearStatusExecutivoParaParametrosSuporte("Cancelado"))}
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-graphite-500">KPIs Operacionais</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardIndicadorExecutivo
          titulo="Tempo Médio de Atendimento"
          valor={dados.tempoMedioAtendimentoMinutos !== null ? formatarTempo(dados.tempoMedioAtendimentoMinutos) : "—"}
          accent="brand"
          icone="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <CardIndicadorExecutivo
          titulo="Tempo Médio de Resolução"
          valor={dados.tempoMedioResolucaoMinutos !== null ? formatarTempo(dados.tempoMedioResolucaoMinutos) : "—"}
          accent="slate"
          icone="M9 3v18M15 3v18M3 9h18M3 15h18"
        />
        <CardIndicadorExecutivo
          titulo="Chamados Atrasados"
          valor={dados.chamadosAtrasados}
          accent="red"
          icone="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
        <CardIndicadorExecutivo
          titulo="Chamados Dentro do SLA"
          valor={dados.chamadosDentroDoSLA}
          accent="green"
          icone="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-graphite-500">Gráficos</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Chamados por Projeto</h3>
          <BarraDistribuicao
            itens={dados.porProjeto}
            corPadrao="bg-neon-500"
            corPorNome={{ [NAO_CLASSIFICADO]: "bg-graphite-500" }}
            montarHref={(nome) =>
              nome === NAO_CLASSIFICADO ? null : montarHrefDrillDown(baseDrillDown, { categoria_projeto: nome })
            }
          />
        </div>
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Chamados por Categoria</h3>
          <BarraDistribuicao
            itens={dados.porCategoria}
            corPadrao="bg-info-500"
            corPorNome={{ [NAO_CLASSIFICADO]: "bg-graphite-500" }}
            montarHref={(nome) =>
              nome === NAO_CLASSIFICADO ? null : montarHrefDrillDown(baseDrillDown, { categoria_principal: nome })
            }
          />
        </div>
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Distribuição por Status</h3>
          <BarraDistribuicao
            itens={dados.porStatusExecutivo}
            corPorNome={{
              Aberto: "bg-red-400",
              "Em Atendimento": "bg-amber-400",
              Concluído: "bg-emerald-500",
              Cancelado: "bg-graphite-500",
            }}
            montarHref={(nome) => montarHrefDrillDown(baseDrillDown, mapearStatusExecutivoParaParametrosSuporte(nome))}
          />
        </div>
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Chamados por Regional</h3>
          <BarraDistribuicao
            itens={dados.topRegionais}
            corPadrao="bg-info-500"
            corPorNome={{ [REGIONAL_NAO_INFORMADA]: "bg-graphite-500" }}
            montarHref={(nome) =>
              nome === REGIONAL_NAO_INFORMADA ? null : montarHrefDrillDown(baseDrillDown, { regional: nome })
            }
          />
        </div>
        <div className="card lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Chamados por Técnico</h3>
          <BarraDistribuicao
            itens={dados.topTecnicos}
            corPadrao="bg-amber-500"
            corPorNome={{ [TECNICO_NAO_INFORMADO]: "bg-graphite-500" }}
            montarHref={(nome) =>
              nome === TECNICO_NAO_INFORMADO ? null : montarHrefDrillDown(baseDrillDown, { tecnico: nome })
            }
          />
        </div>
      </div>

      <div className="mt-6 card">
        <h3 className="mb-1 text-base font-semibold text-graphite-100">Evolução — Chamados por Dia</h3>
        <p className="mb-4 text-xs text-graphite-500">
          {dados.evolucaoDiaria.length > DIAS_EXIBIDOS_EVOLUCAO
            ? `Exibindo os últimos ${DIAS_EXIBIDOS_EVOLUCAO} dias com atendimento.`
            : "Exibindo todo o período com atendimento registrado."}
        </p>
        <GraficoEvolucaoDiaria
          pontos={evolucaoExibida}
          montarHref={(data) => montarHrefDrillDown(baseDrillDown, { data_inicio: data, data_fim: data })}
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-graphite-500">Rankings</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Top 10 Projetos</h3>
          <BarraDistribuicao
            itens={dados.topProjetos}
            corPadrao="bg-neon-500"
            montarHref={(nome) =>
              nome === NAO_CLASSIFICADO ? null : montarHrefDrillDown(baseDrillDown, { categoria_projeto: nome })
            }
          />
        </div>
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Top 10 Categorias</h3>
          <BarraDistribuicao
            itens={dados.topCategorias}
            corPadrao="bg-info-500"
            montarHref={(nome) =>
              nome === NAO_CLASSIFICADO ? null : montarHrefDrillDown(baseDrillDown, { categoria_principal: nome })
            }
          />
        </div>
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Top 10 Subcategorias</h3>
          <BarraDistribuicao
            itens={dados.topSubcategorias}
            corPadrao="bg-emerald-500"
            montarHref={(nome) =>
              nome === SEM_SUBCATEGORIA ? null : montarHrefDrillDown(baseDrillDown, { subcategoria: nome })
            }
          />
        </div>
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Top 10 Técnicos</h3>
          <BarraDistribuicao
            itens={dados.topTecnicos}
            corPadrao="bg-amber-500"
            montarHref={(nome) =>
              nome === TECNICO_NAO_INFORMADO ? null : montarHrefDrillDown(baseDrillDown, { tecnico: nome })
            }
          />
        </div>
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-graphite-100">Top 10 Regionais</h3>
          <BarraDistribuicao
            itens={dados.topRegionais}
            corPadrao="bg-neon-500"
            montarHref={(nome) =>
              nome === REGIONAL_NAO_INFORMADA ? null : montarHrefDrillDown(baseDrillDown, { regional: nome })
            }
          />
        </div>
      </div>
    </div>
  );
}
