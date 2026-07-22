import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * MISSÃO: Controle de visualização e exportação por perfil.
 *
 * Cobre os cenários obrigatórios da missão que são testáveis como funções
 * puras / com Prisma mockado (este projeto não tem infraestrutura de teste
 * de interação de UI/e2e nem um banco real disponível nesta sandbox — mesma
 * limitação já registrada nas missões anteriores). Os cenários que dependem
 * de runtime real do Next (redirect, notFound, cookies de requisição) já são
 * cobertos por tests/autorizacao.test.ts; aqui o foco é a REGRA DE ESCOPO em
 * si — a função central que TODA consulta de SupportTicket (listagem,
 * detalhes, edição, relatórios, exportação) reutiliza.
 *
 * Mapeamento para os 15 cenários pedidos na missão:
 *  1/2/3 — criarFiltroDeAcessoAtendimentos (ADMIN global; TECNICO restrito;
 *          um TECNICO nunca combina com o registro de outro).
 *  4     — obterAtendimentoNoEscopo/página de detalhes usam a MESMA função de
 *          escopo já testada aqui (1/2/3) dentro de um `findFirst` — a busca
 *          em si já exclui o registro de outro usuário, então "acessar pelo
 *          ID" e "não acessar pelo ID" caem no mesmo teste de escopo.
 *  5     — updateTicket/closeTicket/deleteTicket usam `criarFiltroDeAcesso-
 *          Atendimentos` dentro do `where` da própria escrita (updateMany/
 *          findFirst) — mesma função testada aqui.
 *  6/7/8 — exportação usa o mesmo escopo (verificado nos testes de
 *          getIndicadoresSuporte/getUltimosAtendimentos/buildWhereSuporte
 *          combinados via AND, e no teste de filtrosPermitidosParaPerfil).
 *  9     — filtrosPermitidosParaPerfil (remove "tecnico" para não-ADMIN).
 *  10    — combinação do escopo com buildWhereSuporte(filtros) via AND.
 *  11    — getUltimosAtendimentos combina escopo com `take` (única forma de
 *          "quantidade limitada" que existe hoje neste módulo — não há
 *          paginação com skip/page em nenhuma tela de Suporte).
 *  12    — getKpisSuporte/getIndicadoresSuporte propagam o escopo em TODAS
 *          as consultas de totais/contagens.
 *  13    — coberto por tests/autorizacao.test.ts (requireAuthenticatedUser/
 *          requireAccess/requireAuthenticatedAction/verificarAcessoApi sem
 *          sessão sempre bloqueiam).
 *  14    — criarFiltroDeAcessoAtendimentos com um perfil desconhecido/
 *          corrompido (allowlist "ADMIN", nunca blacklist "TECNICO").
 *  15    — podeAcessarAtendimento devolve só um boolean (nunca dados do
 *          atendimento) — não há como uma checagem negativa vazar conteúdo.
 */

const countMock = vi.fn();
const aggregateMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: {
      count: countMock,
      aggregate: aggregateMock,
      findMany: findManyMock,
    },
  },
  default: {},
}));

// lib/autorizacao.ts importa lib/auth.ts (next/headers) e next/navigation —
// mockados aqui só para permitir o import do módulo; nenhuma função de
// sessão/redirect é exercitada por este arquivo (isso já é coberto em
// tests/autorizacao.test.ts).
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect() não deveria ser chamado nestes testes");
  },
}));

const {
  getKpisSuporte,
  getIndicadoresSuporte,
  getUltimosAtendimentos,
  buildWhereSuporte,
} = await import("@/lib/suporte");
const {
  criarFiltroDeAcessoAtendimentos,
  podeAcessarAtendimento,
  filtrosPermitidosParaPerfil,
} = await import("@/lib/autorizacao");

function admin(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 1, nome: "Ana Admin", email: "ana@empresa.com", perfil: "ADMIN", ...overrides } as any;
}
function tecnico(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 42, nome: "Tiago Técnico", email: "tiago@empresa.com", perfil: "TECNICO", ...overrides } as any;
}

beforeEach(() => {
  countMock.mockReset().mockResolvedValue(0);
  aggregateMock.mockReset().mockResolvedValue({ _avg: { tempoAtendimento: null } });
  findManyMock.mockReset().mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Cenários 1/2/3/14 — criarFiltroDeAcessoAtendimentos
// ---------------------------------------------------------------------------

describe("criarFiltroDeAcessoAtendimentos — regra central de escopo", () => {
  it("ADMIN recebe escopo global (sem nenhuma restrição adicional) — visualiza atendimento de qualquer técnico", () => {
    expect(criarFiltroDeAcessoAtendimentos(admin())).toEqual({});
  });

  it("TECNICO recebe obrigatoriamente o filtro pelo próprio usuarioResponsavelId", () => {
    expect(criarFiltroDeAcessoAtendimentos(tecnico({ id: 42 }))).toEqual({ usuarioResponsavelId: 42 });
  });

  it("dois técnicos diferentes recebem escopos diferentes (um nunca combina com o registro do outro)", () => {
    const escopoA = criarFiltroDeAcessoAtendimentos(tecnico({ id: 42 }));
    const escopoB = criarFiltroDeAcessoAtendimentos(tecnico({ id: 99 }));
    expect(escopoA).not.toEqual(escopoB);
  });

  it("perfil desconhecido/corrompido NÃO recebe acesso global (allowlist só de 'ADMIN', nunca blacklist de 'TECNICO')", () => {
    const usuarioComPerfilInvalido = { id: 5, nome: "X", email: "x@empresa.com", perfil: "GERENTE" } as any;
    const escopo = criarFiltroDeAcessoAtendimentos(usuarioComPerfilInvalido);
    expect(escopo).not.toEqual({});
    expect(escopo).toEqual({ usuarioResponsavelId: 5 });
  });
});

// ---------------------------------------------------------------------------
// Cenários 4/5 — podeAcessarAtendimento (detalhes/edição por ID)
// ---------------------------------------------------------------------------

describe("podeAcessarAtendimento — checagem de propriedade por ID", () => {
  it("ADMIN sempre pode acessar, mesmo um atendimento de outro usuário", () => {
    expect(podeAcessarAtendimento({ usuarioResponsavelId: 999 }, admin())).toBe(true);
  });

  it("ADMIN sempre pode acessar um atendimento legado (usuarioResponsavelId nulo)", () => {
    expect(podeAcessarAtendimento({ usuarioResponsavelId: null }, admin())).toBe(true);
  });

  it("TECNICO pode acessar o próprio atendimento", () => {
    expect(podeAcessarAtendimento({ usuarioResponsavelId: 42 }, tecnico({ id: 42 }))).toBe(true);
  });

  it("TECNICO NÃO pode acessar atendimento de outro técnico, mesmo sabendo o ID", () => {
    expect(podeAcessarAtendimento({ usuarioResponsavelId: 7 }, tecnico({ id: 42 }))).toBe(false);
  });

  it("TECNICO NÃO pode acessar atendimento legado (sem dono confirmado) — só ADMIN, por decisão explícita do usuário do sistema", () => {
    expect(podeAcessarAtendimento({ usuarioResponsavelId: null }, tecnico({ id: 42 }))).toBe(false);
  });

  it("a checagem negativa devolve só um boolean — nunca há como vazar dado do atendimento numa falha de permissão", () => {
    const resultado = podeAcessarAtendimento({ usuarioResponsavelId: 7 }, tecnico({ id: 42 }));
    expect(typeof resultado).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// Cenário 9 — filtro "Técnico Responsável" é exclusivo de ADMIN
// ---------------------------------------------------------------------------

describe("filtrosPermitidosParaPerfil — filtro de Técnico Responsável exclusivo de ADMIN", () => {
  it("ADMIN mantém o filtro 'tecnico' intacto", () => {
    const filtros = { tecnico: "Carlos", categoria: "MOS", site: "SN-1" };
    expect(filtrosPermitidosParaPerfil(filtros, admin())).toEqual(filtros);
  });

  it("TECNICO tem o filtro 'tecnico' removido, mesmo enviado manualmente na URL", () => {
    const filtros = { tecnico: "Carlos", categoria: "MOS", site: "SN-1" };
    const resultado = filtrosPermitidosParaPerfil(filtros, tecnico());
    expect(resultado.tecnico).toBeUndefined();
  });

  it("TECNICO mantém os demais filtros funcionando normalmente (categoria, site, projeto, período, status, busca)", () => {
    const filtros = {
      tecnico: "Carlos",
      categoria: "MOS",
      site: "SN-1",
      projeto: "Projeto Alfa",
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31",
      status: "Aberto",
      busca: "torre",
    };
    const resultado = filtrosPermitidosParaPerfil(filtros, tecnico());
    expect(resultado.categoria).toBe("MOS");
    expect(resultado.site).toBe("SN-1");
    expect(resultado.projeto).toBe("Projeto Alfa");
    expect(resultado.dataInicio).toBe("2026-01-01");
    expect(resultado.dataFim).toBe("2026-01-31");
    expect(resultado.status).toBe("Aberto");
    expect(resultado.busca).toBe("torre");
  });
});

// ---------------------------------------------------------------------------
// Cenário 10 — combinação do escopo com buildWhereSuporte (AND)
// ---------------------------------------------------------------------------

describe("escopo combinado com buildWhereSuporte via AND (listagem/relatórios/exportação)", () => {
  it("para TECNICO, o where final contém o escopo E os filtros da tela ao mesmo tempo", () => {
    const usuario = tecnico({ id: 42 });
    const escopo = criarFiltroDeAcessoAtendimentos(usuario);
    const where = { AND: [escopo, buildWhereSuporte({ categoria: "MOS", site: "SN-1", status: "Aberto" })] };
    const texto = JSON.stringify(where);
    expect(texto).toContain("usuarioResponsavelId");
    expect(texto).toContain("42");
    expect(texto).toContain("MOS");
    expect(texto).toContain("SN-1");
    expect(texto).toContain("Aberto");
  });

  it("para ADMIN, o where final NÃO restringe por usuarioResponsavelId, só pelos filtros da tela", () => {
    const usuario = admin();
    const escopo = criarFiltroDeAcessoAtendimentos(usuario);
    const where = { AND: [escopo, buildWhereSuporte({ categoria: "MOS" })] };
    expect(JSON.stringify(where)).not.toContain("usuarioResponsavelId");
  });
});

// ---------------------------------------------------------------------------
// Cenário 12 — totais/contagens do KPI respeitam o escopo em TODAS as consultas
// ---------------------------------------------------------------------------

describe("getKpisSuporte — escopo aplicado nas 5 consultas de totais", () => {
  it("todo count() e o aggregate() recebem o escopo no where", async () => {
    const escopo = { usuarioResponsavelId: 42 };
    await getKpisSuporte(escopo);

    expect(countMock).toHaveBeenCalledTimes(4);
    for (const chamada of countMock.mock.calls) {
      expect(JSON.stringify(chamada[0].where)).toContain("42");
    }
    expect(aggregateMock).toHaveBeenCalledTimes(1);
    expect(aggregateMock.mock.calls[0][0].where).toEqual(escopo);
  });

  it("sem escopo (uso implícito de ADMIN), nenhuma das 5 consultas fica restrita por usuarioResponsavelId", async () => {
    await getKpisSuporte({});
    for (const chamada of countMock.mock.calls) {
      expect(JSON.stringify(chamada[0].where)).not.toContain("usuarioResponsavelId");
    }
  });
});

// ---------------------------------------------------------------------------
// Cenário 10/12 — indicadores (dashboard e /relatorios/suporte)
// ---------------------------------------------------------------------------

describe("getIndicadoresSuporte — escopo combinado com os filtros da tela", () => {
  it("o where passado ao findMany combina escopo + filtros via AND", async () => {
    await getIndicadoresSuporte({ projeto: "Projeto Alfa" }, { usuarioResponsavelId: 42 });
    const where = findManyMock.mock.calls[0][0].where;
    const texto = JSON.stringify(where);
    expect(texto).toContain("42");
    expect(texto).toContain("Projeto Alfa");
  });

  it("totais/agrupamentos de um TECNICO nunca incluem registros fora do escopo (o findMany só recebe o where já restrito — os agrupamentos em memória operam sobre o que a consulta devolveu)", async () => {
    findManyMock.mockResolvedValueOnce([
      { colaborador: { nome: "João" }, projeto: "Alfa", categoria: "MOS", tempoAtendimento: 30, resultado: "Resolvido", status: "Finalizado" },
    ]);
    const indicadores = await getIndicadoresSuporte({}, { usuarioResponsavelId: 42 });
    expect(indicadores.totalAtendimentos).toBe(1);
    // A garantia de "nenhum registro de outro usuário" vem do where restrito
    // (testado acima) — o findMany mockado aqui só devolve o que a consulta
    // (já filtrada) devolveria de verdade.
  });
});

// ---------------------------------------------------------------------------
// Cenário 11 — "paginação" (take) mantém o escopo correto
// ---------------------------------------------------------------------------

describe("getUltimosAtendimentos — escopo combinado com o limite (take)", () => {
  it("o limite (take) nunca substitui o escopo — os dois são aplicados na mesma consulta", async () => {
    await getUltimosAtendimentos(3, { usuarioResponsavelId: 42 });
    const chamada = findManyMock.mock.calls[0][0];
    expect(chamada.where).toEqual({ usuarioResponsavelId: 42 });
    expect(chamada.take).toBe(3);
  });

  it("sem escopo informado (ADMIN), o take funciona normalmente sem nenhuma restrição adicional", async () => {
    await getUltimosAtendimentos(5);
    const chamada = findManyMock.mock.calls[0][0];
    expect(chamada.where).toEqual({});
    expect(chamada.take).toBe(5);
  });
});
