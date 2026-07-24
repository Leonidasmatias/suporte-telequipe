import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sprint "v7.2 — Dashboard Executivo de Suporte" + REVISÃO ("Centro de
 * Controle Operacional").
 *
 * `lib/dashboardSuporte.ts` importa `lib/prisma.ts` (PrismaClient real),
 * `lib/categoriasSuporte.ts` (puro, não mockado — mesma fonte de
 * classificação usada por todo o sistema) e `lib/suporte.ts` (puro,
 * `buildWhereSuporte` não mockado — reaproveitado de verdade). `findMany` é
 * mockado tanto para `supportTicket` quanto para `colaborador`, para simular
 * cenários sem precisar de um banco real (mesmo padrão de
 * tests/escopoAtendimentos.test.ts).
 */

const findManySupportTicketMock = vi.fn();
const findManyColaboradorMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: { findMany: findManySupportTicketMock },
    colaborador: { findMany: findManyColaboradorMock },
  },
  default: {},
}));

const {
  getIndicadoresExecutivosSuporte,
  resolverPeriodo,
  construirClausulaStatusExecutivo,
  construirClausulaRegional,
  montarWhereDashboard,
  montarHrefDrillDown,
  mapearStatusExecutivoParaParametrosSuporte,
  obterRegionaisDisponiveis,
  formatarHoraBrasil,
  formatarDataHoraBrasil,
  construirQueryStringAtual,
  SLA_PADRAO_HORAS,
  PERIODO_PADRAO,
  FUSO_HORARIO_PADRAO,
  calcularChamadosPorProjetoRegional,
} = await import("@/lib/dashboardSuporte");

type TicketFixture = {
  status: string;
  resultado: string;
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  dataAtendimento: Date;
  tempoAtendimento: number | null;
  tecnicoResponsavel: string | null;
  createdAt: Date;
  updatedAt: Date;
  colaborador: { regional: string | null } | null;
  /** Missão "Evolução 7.1" — Projeto/Regional do PRÓPRIO chamado (matriz oficial), distintos do Regional do Colaborador acima. */
  projeto: string | null;
  regional: string | null;
};

function ticket(overrides: Partial<TicketFixture> = {}): TicketFixture {
  return {
    status: "Aberto",
    resultado: "Aguardando Cliente",
    categoriaPrincipal: null,
    subcategoria: null,
    dataAtendimento: new Date("2026-01-10T00:00:00Z"),
    tempoAtendimento: null,
    tecnicoResponsavel: null,
    createdAt: new Date("2026-01-10T00:00:00Z"),
    updatedAt: new Date("2026-01-10T00:00:00Z"),
    colaborador: null,
    projeto: null,
    regional: null,
    ...overrides,
  };
}

beforeEach(() => {
  findManySupportTicketMock.mockReset();
  findManyColaboradorMock.mockReset();
});

describe("getIndicadoresExecutivosSuporte — uma única consulta", () => {
  it("chama supportTicket.findMany exatamente uma vez, com o where recebido", async () => {
    findManySupportTicketMock.mockResolvedValue([]);
    await getIndicadoresExecutivosSuporte({ usuarioResponsavelId: 42 });
    expect(findManySupportTicketMock).toHaveBeenCalledTimes(1);
    expect(findManySupportTicketMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioResponsavelId: 42 } })
    );
  });
});

describe("getIndicadoresExecutivosSuporte — base vazia", () => {
  it("nenhum registro: todos os totais em zero, KPIs nulos/zero, listas de distribuição com os buckets fixos zerados, tops e evolução vazios (sem erro)", async () => {
    findManySupportTicketMock.mockResolvedValue([]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.totalChamados).toBe(0);
    expect(dados.emAberto).toBe(0);
    expect(dados.emAtendimento).toBe(0);
    expect(dados.concluidos).toBe(0);
    expect(dados.cancelados).toBe(0);
    expect(dados.tempoMedioAtendimentoMinutos).toBeNull();
    expect(dados.tempoMedioResolucaoMinutos).toBeNull();
    expect(dados.chamadosAtrasados).toBe(0);
    expect(dados.chamadosDentroDoSLA).toBe(0);
    expect(dados.porCategoria).toEqual([
      { nome: "MOS", quantidade: 0 },
      { nome: "Infraestrutura", quantidade: 0 },
      { nome: "Instalação", quantidade: 0 },
      { nome: "Ativação", quantidade: 0 },
      { nome: "Aceitação", quantidade: 0 },
    ]);
    expect(dados.porStatusExecutivo).toEqual([
      { nome: "Aberto", quantidade: 0 },
      { nome: "Em Atendimento", quantidade: 0 },
      { nome: "Concluído", quantidade: 0 },
      { nome: "Cancelado", quantidade: 0 },
    ]);
    expect(dados.topCategorias).toEqual([]);
    expect(dados.topSubcategorias).toEqual([]);
    expect(dados.topTecnicos).toEqual([]);
    expect(dados.topRegionais).toEqual([]);
    expect(dados.evolucaoDiaria).toEqual([]);
    expect(dados.chamadosPorProjetoRegional).toEqual([]);
  });
});

describe("getIndicadoresExecutivosSuporte — cards / status executivo", () => {
  it("totaliza Em Aberto / Em Atendimento / Concluídos corretamente a partir do campo status", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ status: "Aberto", resultado: "Aguardando Cliente" }),
      ticket({ status: "Aberto", resultado: "Aguardando Material" }),
      ticket({ status: "Em Atendimento", resultado: "Aguardando Cliente" }),
      ticket({ status: "Finalizado", resultado: "Resolvido" }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.totalChamados).toBe(4);
    expect(dados.emAberto).toBe(2);
    expect(dados.emAtendimento).toBe(1);
    expect(dados.concluidos).toBe(1);
    expect(dados.cancelados).toBe(0);
  });

  it("resultado 'Cancelado' conta como Cancelado independentemente do status atual (prioridade sobre o status)", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ status: "Finalizado", resultado: "Cancelado" }),
      ticket({ status: "Aberto", resultado: "Cancelado" }),
      ticket({ status: "Em Atendimento", resultado: "Cancelado" }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.cancelados).toBe(3);
    expect(dados.emAberto).toBe(0);
    expect(dados.emAtendimento).toBe(0);
    expect(dados.concluidos).toBe(0);
  });

  it("a soma dos 4 buckets de status executivo sempre bate com o total de chamados (partição sem sobreposição)", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ status: "Aberto", resultado: "Aguardando Cliente" }),
      ticket({ status: "Em Atendimento", resultado: "Aguardando Material" }),
      ticket({ status: "Finalizado", resultado: "Resolvido" }),
      ticket({ status: "Finalizado", resultado: "Cancelado" }),
      ticket({ status: "Finalizado", resultado: "Resolvido Parcialmente" }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    const somaBuckets = dados.emAberto + dados.emAtendimento + dados.concluidos + dados.cancelados;
    expect(somaBuckets).toBe(dados.totalChamados);
    expect(dados.totalChamados).toBe(5);
  });
});

describe("getIndicadoresExecutivosSuporte — distribuição por Categoria (v7.3 — sem nível de Projeto/Fabricante)", () => {
  it("reconhece exatamente as 5 Categorias Principais atuais e conta em 'Não classificado' qualquer outro valor (nunca classificado ou de uma matriz anterior)", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ categoriaPrincipal: "MOS" }),
      ticket({ categoriaPrincipal: "MOS" }),
      ticket({ categoriaPrincipal: "Ativação" }),
      ticket({ categoriaPrincipal: "NOKIA > MOS" }),
      ticket({ categoriaPrincipal: "NOKIA" }),
      ticket({ categoriaPrincipal: null }),
      ticket({ categoriaPrincipal: "IEZ > Dia de Integração" }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();

    const mos = dados.porCategoria.find((c) => c.nome === "MOS");
    const ativacao = dados.porCategoria.find((c) => c.nome === "Ativação");
    const naoClassificadoCategoria = dados.porCategoria.find((c) => c.nome === "Não classificado");
    expect(mos?.quantidade).toBe(2);
    expect(ativacao?.quantidade).toBe(1);
    expect(naoClassificadoCategoria?.quantidade).toBe(4);
  });

  it("todas as 5 Categorias Principais oficiais sempre aparecem em porCategoria, mesmo com 0 chamados", async () => {
    findManySupportTicketMock.mockResolvedValue([ticket({ categoriaPrincipal: "MOS" })]);
    const dados = await getIndicadoresExecutivosSuporte();
    const nomes = dados.porCategoria.map((c) => c.nome);
    expect(nomes).toEqual(
      expect.arrayContaining(["MOS", "Infraestrutura", "Instalação", "Ativação", "Aceitação"])
    );
    expect(dados.porCategoria.find((c) => c.nome === "Ativação")?.quantidade).toBe(0);
  });
});

describe("getIndicadoresExecutivosSuporte — Top 10", () => {
  it("topCategorias fica ordenado por quantidade decrescente e limitado a 10", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ categoriaPrincipal: "MOS" }),
      ticket({ categoriaPrincipal: "MOS" }),
      ticket({ categoriaPrincipal: "MOS" }),
      ticket({ categoriaPrincipal: "Ativação" }),
      ticket({ categoriaPrincipal: "Ativação" }),
      ticket({ categoriaPrincipal: "Aceitação" }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.topCategorias[0]).toEqual({ nome: "MOS", quantidade: 3 });
    expect(dados.topCategorias[1]).toEqual({ nome: "Ativação", quantidade: 2 });
  });

  it("topSubcategorias usa 'Sem subcategoria' para valores vazios", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ subcategoria: "Material" }),
      ticket({ subcategoria: null }),
      ticket({ subcategoria: null }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.topSubcategorias.find((s) => s.nome === "Sem subcategoria")?.quantidade).toBe(2);
    expect(dados.topSubcategorias.find((s) => s.nome === "Material")?.quantidade).toBe(1);
  });

  it("topTecnicos/topRegionais agrupam por tecnicoResponsavel/colaborador.regional, com buckets 'não informado' para valores vazios", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ tecnicoResponsavel: "Carlos", colaborador: { regional: "Sul" } }),
      ticket({ tecnicoResponsavel: "Carlos", colaborador: { regional: "Sul" } }),
      ticket({ tecnicoResponsavel: "Ana", colaborador: { regional: "Norte" } }),
      ticket({ tecnicoResponsavel: null, colaborador: null }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.topTecnicos[0]).toEqual({ nome: "Carlos", quantidade: 2 });
    expect(dados.topTecnicos.find((t) => t.nome === "Técnico não informado")?.quantidade).toBe(1);
    expect(dados.topRegionais.find((r) => r.nome === "Sul")?.quantidade).toBe(2);
    expect(dados.topRegionais.find((r) => r.nome === "Regional não informada")?.quantidade).toBe(1);
  });
});

describe("getIndicadoresExecutivosSuporte — evolução diária", () => {
  it("agrupa por dia (YYYY-MM-DD) e ordena por data crescente", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ dataAtendimento: new Date("2026-02-02T08:00:00Z") }),
      ticket({ dataAtendimento: new Date("2026-02-01T23:00:00Z") }),
      ticket({ dataAtendimento: new Date("2026-02-01T10:00:00Z") }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.evolucaoDiaria).toEqual([
      { data: "2026-02-01", quantidade: 2 },
      { data: "2026-02-02", quantidade: 1 },
    ]);
  });
});

describe("getIndicadoresExecutivosSuporte — KPIs Operacionais (Sprint v7.2 REVISÃO)", () => {
  it("Tempo Médio de Atendimento é a média de tempoAtendimento, ignorando nulos", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ tempoAtendimento: 30 }),
      ticket({ tempoAtendimento: 60 }),
      ticket({ tempoAtendimento: null }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.tempoMedioAtendimentoMinutos).toBe(45);
  });

  it("Tempo Médio de Resolução é calculado por (updatedAt - createdAt), só para chamados executivamente Concluído", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({
        status: "Finalizado",
        resultado: "Resolvido",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T01:00:00Z"), // 60 min
      }),
      ticket({
        status: "Finalizado",
        resultado: "Resolvido",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:30:00Z"), // 30 min
      }),
      // Cancelado — mesmo com status "Finalizado", não entra no cálculo (é
      // "Cancelado" no bucket executivo, não "Concluído").
      ticket({
        status: "Finalizado",
        resultado: "Cancelado",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-05T00:00:00Z"),
      }),
      // Ainda aberto — não entra no cálculo.
      ticket({ status: "Aberto", resultado: "Aguardando Cliente" }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();
    expect(dados.tempoMedioResolucaoMinutos).toBe(45);
  });

  it("Chamados Atrasados/Dentro do SLA: só avalia chamados Aberto/Em Atendimento, comparando (agora - createdAt) contra SLA_PADRAO_HORAS", async () => {
    const agora = new Date("2026-01-10T00:00:00Z");
    findManySupportTicketMock.mockResolvedValue([
      // Aberto há mais de 24h → atrasado.
      ticket({ status: "Aberto", resultado: "Aguardando Cliente", createdAt: new Date("2026-01-08T00:00:00Z") }),
      // Em atendimento há 1h → dentro do SLA.
      ticket({ status: "Em Atendimento", resultado: "Aguardando Cliente", createdAt: new Date("2026-01-09T23:00:00Z") }),
      // Concluído há muito tempo → não entra em nenhum dos 2 contadores.
      ticket({
        status: "Finalizado",
        resultado: "Resolvido",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T01:00:00Z"),
      }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte({}, agora);
    expect(dados.chamadosAtrasados).toBe(1);
    expect(dados.chamadosDentroDoSLA).toBe(1);
    expect(SLA_PADRAO_HORAS).toBe(24);
  });
});

describe("resolverPeriodo — tradução do filtro Período em intervalo concreto de datas", () => {
  const agora = new Date("2026-07-23T12:00:00Z");

  it("'hoje' resolve para a data de hoje em ambas as pontas", () => {
    expect(resolverPeriodo("hoje", undefined, undefined, agora)).toEqual({
      dataInicio: "2026-07-23",
      dataFim: "2026-07-23",
    });
  });

  it("'7dias' resolve para um intervalo de 7 dias terminando hoje", () => {
    expect(resolverPeriodo("7dias", undefined, undefined, agora)).toEqual({
      dataInicio: "2026-07-17",
      dataFim: "2026-07-23",
    });
  });

  it("'30dias' resolve para um intervalo de 30 dias terminando hoje", () => {
    expect(resolverPeriodo("30dias", undefined, undefined, agora)).toEqual({
      dataInicio: "2026-06-24",
      dataFim: "2026-07-23",
    });
  });

  it("'mes' resolve para o primeiro dia do mês corrente até hoje", () => {
    expect(resolverPeriodo("mes", undefined, undefined, agora)).toEqual({
      dataInicio: "2026-07-01",
      dataFim: "2026-07-23",
    });
  });

  it("'personalizado' usa exatamente as datas informadas", () => {
    expect(resolverPeriodo("personalizado", "2026-01-01", "2026-01-15", agora)).toEqual({
      dataInicio: "2026-01-01",
      dataFim: "2026-01-15",
    });
  });

  it("'todos' não aplica nenhum limite de data", () => {
    expect(resolverPeriodo("todos", undefined, undefined, agora)).toEqual({});
  });

  it("período ausente/desconhecido cai no padrão (PERIODO_PADRAO)", () => {
    expect(resolverPeriodo(undefined, undefined, undefined, agora)).toEqual(
      resolverPeriodo(PERIODO_PADRAO, undefined, undefined, agora)
    );
  });
});

describe("construirClausulaStatusExecutivo — Filtro Global de Status", () => {
  it("'Cancelado' filtra por resultado, não por status", () => {
    expect(construirClausulaStatusExecutivo("Cancelado")).toEqual({ resultado: "Cancelado" });
  });

  it("'Concluído' filtra status Finalizado E exclui explicitamente resultado Cancelado", () => {
    expect(construirClausulaStatusExecutivo("Concluído")).toEqual({
      status: "Finalizado",
      NOT: { resultado: "Cancelado" },
    });
  });

  it("'Em Atendimento' e 'Aberto' também excluem resultado Cancelado (mesma prioridade do statusExecutivo)", () => {
    expect(construirClausulaStatusExecutivo("Em Atendimento")).toEqual({
      status: "Em Atendimento",
      NOT: { resultado: "Cancelado" },
    });
    expect(construirClausulaStatusExecutivo("Aberto")).toEqual({
      status: "Aberto",
      NOT: { resultado: "Cancelado" },
    });
  });

  it("sem status informado, não filtra nada", () => {
    expect(construirClausulaStatusExecutivo(undefined)).toEqual({});
  });
});

describe("construirClausulaRegional — Filtro Global de Regional", () => {
  it("filtra por colaborador.regional (equals, case-insensitive)", () => {
    expect(construirClausulaRegional("Sul")).toEqual({
      colaborador: { regional: { equals: "Sul", mode: "insensitive" } },
    });
  });

  it("sem regional informada, não filtra nada", () => {
    expect(construirClausulaRegional(undefined)).toEqual({});
  });
});

describe("montarWhereDashboard — combina escopo de acesso + Filtros Globais em uma única cláusula", () => {
  it("reaproveita buildWhereSuporte para Projeto/Categoria/Técnico/Período dentro do AND", () => {
    const where = montarWhereDashboard(
      { usuarioResponsavelId: 7 },
      { projeto: "NOKIA", categoria: "MOS", tecnico: "Carlos", periodo: "todos" }
    );
    const texto = JSON.stringify(where);
    expect(texto).toContain("usuarioResponsavelId");
    expect(texto).toContain("NOKIA");
    expect(texto).toContain("MOS");
    expect(texto).toContain("Carlos");
  });

  it("combina Status executivo e Regional (cláusulas próprias) dentro do mesmo AND", () => {
    const where = montarWhereDashboard({}, { statusExecutivo: "Cancelado", regional: "Sul" });
    const texto = JSON.stringify(where);
    expect(texto).toContain("Cancelado");
    expect(texto).toContain("Sul");
  });
});

describe("mapearStatusExecutivoParaParametrosSuporte — tradução do bucket executivo para os parâmetros de /suporte", () => {
  it("'Cancelado' vira { resultado: 'Cancelado' }", () => {
    expect(mapearStatusExecutivoParaParametrosSuporte("Cancelado")).toEqual({ resultado: "Cancelado" });
  });

  it("'Concluído' vira { status: 'Finalizado' }", () => {
    expect(mapearStatusExecutivoParaParametrosSuporte("Concluído")).toEqual({ status: "Finalizado" });
  });

  it("'Aberto'/'Em Atendimento' viram { status: <mesmo valor> }", () => {
    expect(mapearStatusExecutivoParaParametrosSuporte("Aberto")).toEqual({ status: "Aberto" });
    expect(mapearStatusExecutivoParaParametrosSuporte("Em Atendimento")).toEqual({ status: "Em Atendimento" });
  });

  it("sem status, não gera nenhum parâmetro", () => {
    expect(mapearStatusExecutivoParaParametrosSuporte(undefined)).toEqual({});
  });
});

describe("montarHrefDrillDown — construção pura da URL de /suporte para o drill-down", () => {
  it("combina base + extra em uma query string, com extra tendo prioridade sobre base para a mesma chave", () => {
    const href = montarHrefDrillDown({ status: "Aberto", categoria_principal: "MOS" }, { status: "Finalizado" });
    expect(href).toBe("/suporte?status=Finalizado&categoria_principal=MOS");
  });

  it("omite parâmetros vazios/undefined", () => {
    const href = montarHrefDrillDown({ data_inicio: undefined, categoria_principal: "MOS" });
    expect(href).toBe("/suporte?categoria_principal=MOS");
  });

  it("sem nenhum parâmetro, retorna '/suporte' sem query string", () => {
    expect(montarHrefDrillDown({})).toBe("/suporte");
  });
});

describe("obterRegionaisDisponiveis — opções do filtro Regional", () => {
  it("consulta colaborador.findMany (distinct, sem nulos) e devolve só os nomes", async () => {
    findManyColaboradorMock.mockResolvedValue([{ regional: "Norte" }, { regional: "Sul" }]);
    const regionais = await obterRegionaisDisponiveis();
    expect(findManyColaboradorMock).toHaveBeenCalledTimes(1);
    expect(regionais).toEqual(["Norte", "Sul"]);
  });

  it("base vazia: devolve lista vazia, sem erro", async () => {
    findManyColaboradorMock.mockResolvedValue([]);
    const regionais = await obterRegionaisDisponiveis();
    expect(regionais).toEqual([]);
  });
});

describe("formatarHoraBrasil / formatarDataHoraBrasil — 'Última atualização' (Sprint v7.2 — ÚLTIMA REVISÃO)", () => {
  // 2026-07-23T17:37:22Z = 14:37:22 em America/Sao_Paulo (UTC-3, sem horário
  // de verão desde 2019) — instante fixo, escolhido para o teste não
  // depender do fuso horário da máquina que executa o Vitest.
  const instante = new Date("2026-07-23T17:37:22Z");

  it("formatarHoraBrasil devolve HH:mm:ss no fuso America/Sao_Paulo", () => {
    expect(formatarHoraBrasil(instante)).toBe("14:37:22");
  });

  it("formatarDataHoraBrasil devolve 'DD/MM/AAAA às HH:mm:ss', com o horário claramente visível", () => {
    const texto = formatarDataHoraBrasil(instante);
    expect(texto).toBe("23/07/2026 às 14:37:22");
    expect(texto).toContain("14:37:22");
  });

  it("o horário é formatado de maneira válida (padrão de 2 dígitos para hora/minuto/segundo)", () => {
    expect(formatarHoraBrasil(instante)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("respeita um fuso horário diferente quando explicitamente informado (não fixo/hardcoded)", () => {
    // UTC: 3h à frente de São Paulo no mesmo instante.
    expect(formatarHoraBrasil(instante, "UTC")).toBe("17:37:22");
  });

  it("FUSO_HORARIO_PADRAO é America/Sao_Paulo", () => {
    expect(FUSO_HORARIO_PADRAO).toBe("America/Sao_Paulo");
  });

  it("horário muda quando o instante muda (não é um valor fixo)", () => {
    const outroInstante = new Date("2026-07-23T18:00:00Z");
    expect(formatarHoraBrasil(instante)).not.toBe(formatarHoraBrasil(outroInstante));
  });
});

describe("construirQueryStringAtual — botão 'Atualizar Dashboard' preserva os filtros ativos (Sprint v7.2 — ÚLTIMA REVISÃO)", () => {
  it("serializa searchParams simples de volta em uma query string", () => {
    expect(construirQueryStringAtual({ projeto: "NOKIA", periodo: "30dias" })).toBe("projeto=NOKIA&periodo=30dias");
  });

  it("preserva múltiplos filtros globais simultaneamente, sem perder nenhum", () => {
    const query = construirQueryStringAtual({
      projeto: "NOKIA",
      categoria: "MOS",
      status: "Aberto",
      regional: "Sul",
      periodo: "30dias",
    });
    const params = new URLSearchParams(query);
    expect(params.get("projeto")).toBe("NOKIA");
    expect(params.get("categoria")).toBe("MOS");
    expect(params.get("status")).toBe("Aberto");
    expect(params.get("regional")).toBe("Sul");
    expect(params.get("periodo")).toBe("30dias");
  });

  it("ignora valores undefined, sem inseri-los na query string", () => {
    expect(construirQueryStringAtual({ projeto: "NOKIA", categoria: undefined })).toBe("projeto=NOKIA");
  });

  it("sem nenhum parâmetro ativo, devolve string vazia", () => {
    expect(construirQueryStringAtual({})).toBe("");
  });

  it("suporta parâmetros multivalorados (array), preservando todos os valores", () => {
    const query = construirQueryStringAtual({ tag: ["a", "b"] });
    const params = new URLSearchParams(query);
    expect(params.getAll("tag")).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// Missão "TELEQUIPE SUPORTE STA — Evolução 7.1" — novo gráfico "Chamados por
// Projeto e Regional" (itens 12, 13, 14 e 15 da lista de testes obrigatórios).
// ---------------------------------------------------------------------------

describe("calcularChamadosPorProjetoRegional — agrega corretamente Projeto x Regional (item 12)", () => {
  it("sem nenhum chamado, devolve lista vazia", () => {
    expect(calcularChamadosPorProjetoRegional([])).toEqual([]);
  });

  it("agrupa corretamente por Projeto e conta cada Regional dentro do grupo", () => {
    const resultado = calcularChamadosPorProjetoRegional([
      { projeto: "NOKIA-TIM", regional: "SP" },
      { projeto: "NOKIA-TIM", regional: "SP" },
      { projeto: "NOKIA-TIM", regional: "MG" },
      { projeto: "HUAWEI-TIM", regional: "BASE" },
    ]);
    expect(resultado).toEqual([
      { projeto: "NOKIA-TIM", regionais: { SP: 2, MG: 1 }, total: 3 },
      { projeto: "HUAWEI-TIM", regionais: { BASE: 1 }, total: 1 },
    ]);
  });

  it("só inclui Projetos que possuem pelo menos 1 chamado no conjunto recebido", () => {
    const resultado = calcularChamadosPorProjetoRegional([{ projeto: "IEZ-ZTE", regional: "MG" }]);
    expect(resultado).toEqual([{ projeto: "IEZ-ZTE", regionais: { MG: 1 }, total: 1 }]);
    expect(resultado.some((p) => p.projeto === "ZTE-CLARO")).toBe(false);
  });

  it('chamados sem Projeto ou Regional são agrupados como "Não classificado" (item 13)', () => {
    const resultado = calcularChamadosPorProjetoRegional([
      { projeto: null, regional: null },
      { projeto: "Expansão 5G Regional Sul", regional: null }, // texto livre legado, fora da matriz
      { projeto: "NOKIA-TIM", regional: "CO" },
    ]);
    expect(resultado).toEqual([
      { projeto: "NOKIA-TIM", regionais: { CO: 1 }, total: 1 },
      { projeto: "Projeto não classificado", regionais: { "Regional não classificada": 2 }, total: 2 },
    ]);
  });

  it("Projeto oficial com combinação fora da matriz atual vira Combinação histórica, nunca é descartado", () => {
    const resultado = calcularChamadosPorProjetoRegional([
      { projeto: "HUAWEI-TIM", regional: "SP" },
      { projeto: "HUAWEI-TIM", regional: "BASE" },
    ]);
    expect(resultado).toEqual([
      { projeto: "HUAWEI-TIM", regionais: { "Combinação histórica": 1, BASE: 1 }, total: 2 },
    ]);
  });

  it("o total do gráfico corresponde ao total de chamados considerados (item 14)", () => {
    const tickets = [
      { projeto: "NOKIA-TIM", regional: "SP" },
      { projeto: "NOKIA-TIM", regional: "MG" },
      { projeto: "ZTE-CLARO", regional: "RJ" },
      { projeto: null, regional: null },
    ];
    const resultado = calcularChamadosPorProjetoRegional(tickets);
    const totalAgregado = resultado.reduce((soma, p) => soma + p.total, 0);
    expect(totalAgregado).toBe(tickets.length);
  });

  it("nunca conta o mesmo chamado duas vezes (cada chamado incrementa exatamente 1 combinação Projeto/Regional)", () => {
    const tickets = Array.from({ length: 25 }, (_, i) => ({
      projeto: "ZTE-CLARO",
      regional: ["NO", "RJ", "SP", "MG"][i % 4],
    }));
    const resultado = calcularChamadosPorProjetoRegional(tickets);
    expect(resultado).toHaveLength(1);
    const totalAgregado = Object.values(resultado[0].regionais).reduce((s, v) => s + v, 0);
    expect(totalAgregado).toBe(25);
    expect(resultado[0].total).toBe(25);
  });
});

describe("getIndicadoresExecutivosSuporte — chamadosPorProjetoRegional integrado à consulta única (sem regressão nos demais gráficos, item 15)", () => {
  it("popula chamadosPorProjetoRegional a partir dos mesmos registros da única consulta, sem afetar os demais indicadores", async () => {
    findManySupportTicketMock.mockResolvedValue([
      ticket({ projeto: "NOKIA-TIM", regional: "SP", categoriaPrincipal: "MOS" }),
      ticket({ projeto: "NOKIA-TIM", regional: "MG", categoriaPrincipal: "MOS" }),
      ticket({ projeto: "HUAWEI-TIM", regional: "BASE", categoriaPrincipal: "Infraestrutura" }),
    ]);
    const dados = await getIndicadoresExecutivosSuporte();

    expect(dados.totalChamados).toBe(3);
    expect(dados.chamadosPorProjetoRegional).toEqual([
      { projeto: "NOKIA-TIM", regionais: { SP: 1, MG: 1 }, total: 2 },
      { projeto: "HUAWEI-TIM", regionais: { BASE: 1 }, total: 1 },
    ]);
    // Regressão: os gráficos/indicadores pré-existentes (baseados na
    // Categoria Principal da hierarquia de Categoria do Atendimento, campo
    // `categoriaPrincipal` — conceito INDEPENDENTE do Projeto x Regional
    // oficial) continuam funcionando exatamente como antes, a partir da
    // mesma única consulta.
    expect(dados.porCategoria.find((c) => c.nome === "MOS")?.quantidade).toBe(2);
    expect(dados.porCategoria.find((c) => c.nome === "Infraestrutura")?.quantidade).toBe(1);
    expect(findManySupportTicketMock).toHaveBeenCalledTimes(1);
  });
});
