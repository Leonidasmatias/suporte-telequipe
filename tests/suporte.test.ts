import { describe, it, expect, vi } from "vitest";

// `lib/suporte.ts` importa `lib/prisma.ts`, que instancia um PrismaClient real
// no topo do módulo. Este arquivo de teste só exercita funções puras
// (normalizarSite, buildWhereSuporte), então o cliente Prisma é substituído
// por um stub apenas para permitir o import — nenhuma consulta é executada
// aqui (mesmo padrão já usado em tests/exportarAtendimentos.test.ts).
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const { normalizarSite, buildWhereSuporte, TAMANHO_MAXIMO_SITE } = await import("@/lib/suporte");

describe("normalizarSite — campo Site do atendimento", () => {
  it("converte para maiúsculas", () => {
    expect(normalizarSite("sn-aqdik4")).toBe("SN-AQDIK4");
  });

  it("remove espaços no início e no final", () => {
    expect(normalizarSite("  SN-AQDIK4  ")).toBe("SN-AQDIK4");
  });

  it("mantém letras, números e hífen", () => {
    expect(normalizarSite("SN-AQDIK4-2")).toBe("SN-AQDIK4-2");
  });

  it("descarta caracteres que não são letra/número/hífen, sem rejeitar o campo inteiro", () => {
    expect(normalizarSite("SN AQDIK4!")).toBe("SNAQDIK4");
    expect(normalizarSite("SN_AQDIK4")).toBe("SNAQDIK4");
  });

  it("string vazia ou só espaços vira null", () => {
    expect(normalizarSite("")).toBeNull();
    expect(normalizarSite("   ")).toBeNull();
  });

  it("null/undefined vira null (campo opcional)", () => {
    expect(normalizarSite(null)).toBeNull();
    expect(normalizarSite(undefined)).toBeNull();
  });

  it("string composta só por caracteres inválidos vira null", () => {
    expect(normalizarSite("!!!")).toBeNull();
  });

  it("trunca no tamanho máximo (30 caracteres)", () => {
    const entrada = "SN-" + "A".repeat(40);
    const resultado = normalizarSite(entrada);
    expect(resultado).not.toBeNull();
    expect(resultado!.length).toBe(TAMANHO_MAXIMO_SITE);
    expect(resultado).toBe(entrada.toUpperCase().slice(0, TAMANHO_MAXIMO_SITE));
  });
});

describe("buildWhereSuporte — filtro por classificação hierárquica de categoria", () => {
  it("filtro por Categoria Principal aparece no where (busca estruturada)", () => {
    const where = buildWhereSuporte({ categoriaPrincipal: "3 - ATIVAÇÃO" });
    expect(JSON.stringify(where)).toContain("3 - ATIVAÇÃO");
  });

  it("filtro por Categoria Principal também inclui a busca textual no campo legado `categoria` (compatibilidade com registros antigos)", () => {
    const where = buildWhereSuporte({ categoriaPrincipal: "3 - ATIVAÇÃO" });
    const texto = JSON.stringify(where);
    expect(texto).toContain("categoriaPrincipal");
    expect(texto).toContain("insensitive");
  });

  it("filtro por Subcategoria aparece no where", () => {
    const where = buildWhereSuporte({ subcategoria: "B - ALARMES" });
    const texto = JSON.stringify(where);
    expect(texto).toContain("B - ALARMES");
    expect(texto).toContain("subcategoria");
  });

  it("filtro por Detalhamento aparece no where", () => {
    const where = buildWhereSuporte({ detalhamento: "B2 - TESTE FÍSICO" });
    const texto = JSON.stringify(where);
    expect(texto).toContain("B2 - TESTE FÍSICO");
    expect(texto).toContain("detalhamento");
  });

  it("sem nenhum filtro de categoria hierárquica, o where não inclui essas cláusulas", () => {
    const where = buildWhereSuporte({});
    const texto = JSON.stringify(where);
    expect(texto).not.toContain("categoriaPrincipal");
    expect(texto).not.toContain("subcategoria");
    expect(texto).not.toContain("detalhamento");
  });
});

describe("buildWhereSuporte — filtro por Site", () => {
  it("busca completa: filtro igual ao site salvo aparece no where (contains, case-insensitive)", () => {
    const where = buildWhereSuporte({ site: "SN-AQDIK4" });
    const texto = JSON.stringify(where);
    expect(texto).toContain("SN-AQDIK4");
    expect(texto).toContain("insensitive");
  });

  it("busca parcial: um trecho do site também é aceito pelo where (mesma cláusula `contains`)", () => {
    const where = buildWhereSuporte({ site: "AQDIK4" });
    expect(JSON.stringify(where)).toContain("AQDIK4");
  });

  it("sem filtro de site, o where não inclui a cláusula de site", () => {
    const where = buildWhereSuporte({});
    expect(JSON.stringify(where)).not.toContain("site");
  });

  it("combina o filtro de site com outros filtros já existentes (ex.: técnico) sem conflito", () => {
    const where = buildWhereSuporte({ site: "SN-AQDIK4", tecnico: "Carlos" });
    const texto = JSON.stringify(where);
    expect(texto).toContain("SN-AQDIK4");
    expect(texto).toContain("Carlos");
  });
});
