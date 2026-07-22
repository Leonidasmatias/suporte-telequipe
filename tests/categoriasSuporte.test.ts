import { describe, it, expect } from "vitest";
import {
  obterCategoriasPrincipais,
  obterSubcategorias,
  obterDetalhamentos,
  validarClassificacaoSuporte,
  formatarCategoriaHierarquica,
  obterRotuloCategoriaExibicao,
} from "@/lib/categoriasSuporte";

// Este módulo é TypeScript puro (não importa Prisma nem Next), então os
// testes rodam direto contra as funções reais, sem nenhum mock.

describe("obterCategoriasPrincipais", () => {
  it("inclui as categorias dos dois grupos oficiais", () => {
    const categorias = obterCategoriasPrincipais();
    const valores = categorias.map((c) => c.valor);
    expect(valores).toContain("0 - INTEGRAÇÃO");
    expect(valores).toContain("A - TREINAMENTO");
    expect(valores).toContain("3 - ATIVAÇÃO");
    expect(valores).toContain("4 - INFRAESTRUTURA");
    expect(valores).toContain("5 - ACEITAÇÃO");

    const grupoDeAtivacao = categorias.find((c) => c.valor === "3 - ATIVAÇÃO");
    expect(grupoDeAtivacao?.grupo).toBe("GRUPO NOKIA");
    const grupoDeTreinamento = categorias.find((c) => c.valor === "A - TREINAMENTO");
    expect(grupoDeTreinamento?.grupo).toBe("GRUPO GERAL");
  });
});

describe("obterSubcategorias", () => {
  it("retorna as subcategorias de uma categoria com subníveis", () => {
    expect(obterSubcategorias("3 - ATIVAÇÃO")).toEqual([
      "A - CONFIGURAÇÃO",
      "B - ALARMES",
      "C - ATUALIZAÇÃO DE SOFTWARE",
      "D - SCRIPT / XML",
      "E - ORIENTAÇÃO",
    ]);
  });

  it("retorna subcategorias sem código próprio (0 - INTEGRAÇÃO)", () => {
    expect(obterSubcategorias("0 - INTEGRAÇÃO")).toEqual(["PRESENCIAL", "ON-LINE"]);
  });

  it("retorna lista vazia para categoria sem subcategoria (A - TREINAMENTO)", () => {
    expect(obterSubcategorias("A - TREINAMENTO")).toEqual([]);
  });

  it("retorna lista vazia para categoria inexistente ou vazia", () => {
    expect(obterSubcategorias("X - NÃO EXISTE")).toEqual([]);
    expect(obterSubcategorias(null)).toEqual([]);
    expect(obterSubcategorias(undefined)).toEqual([]);
  });
});

describe("obterDetalhamentos", () => {
  it("retorna os detalhamentos de uma subcategoria com subníveis", () => {
    expect(obterDetalhamentos("3 - ATIVAÇÃO", "B - ALARMES")).toEqual([
      "B1 - CONFIGURAÇÃO",
      "B2 - TESTE FÍSICO",
    ]);
  });

  it("retorna lista vazia para subcategoria sem detalhamento", () => {
    expect(obterDetalhamentos("3 - ATIVAÇÃO", "A - CONFIGURAÇÃO")).toEqual([]);
  });

  it("retorna lista vazia quando a subcategoria não pertence à categoria informada", () => {
    // "A - ENERGIA" pertence a "4 - INFRAESTRUTURA", não a "3 - ATIVAÇÃO".
    expect(obterDetalhamentos("3 - ATIVAÇÃO", "A - ENERGIA")).toEqual([]);
  });
});

describe("validarClassificacaoSuporte", () => {
  it("aceita hierarquia completa e válida (3 - ATIVAÇÃO > B - ALARMES > B2 - TESTE FÍSICO)", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "3 - ATIVAÇÃO",
      subcategoria: "B - ALARMES",
      detalhamento: "B2 - TESTE FÍSICO",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita categoria de 2 níveis, sem detalhamento (1 - MOS > A - APLICATIVOS)", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "1 - MOS",
      subcategoria: "A - APLICATIVOS",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita categoria com subcategoria sem código, sem detalhamento (0 - INTEGRAÇÃO > PRESENCIAL)", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "0 - INTEGRAÇÃO",
      subcategoria: "PRESENCIAL",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita categoria principal sem subcategoria (A - TREINAMENTO)", () => {
    const resultado = validarClassificacaoSuporte({ categoriaPrincipal: "A - TREINAMENTO" });
    expect(resultado.valido).toBe(true);
  });

  it("aceita tudo vazio (nenhuma nova classificação escolhida — preserva legado na edição)", () => {
    const resultado = validarClassificacaoSuporte({});
    expect(resultado.valido).toBe(true);
  });

  it("rejeita combinação inválida de categoria/subcategoria (3 - ATIVAÇÃO + A - ENERGIA)", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "3 - ATIVAÇÃO",
      subcategoria: "A - ENERGIA",
    });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.erro).toContain("não pertence");
  });

  it("rejeita combinação inválida de subcategoria/detalhamento", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "3 - ATIVAÇÃO",
      subcategoria: "B - ALARMES",
      // "A1 - CONFIGURAÇÃO" pertence a "4 - INFRAESTRUTURA > A - ENERGIA".
      detalhamento: "A1 - CONFIGURAÇÃO",
    });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.erro).toContain("não pertence");
  });

  it("rejeita categoria principal desconhecida", () => {
    const resultado = validarClassificacaoSuporte({ categoriaPrincipal: "9 - INEXISTENTE" });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita subcategoria/detalhamento preenchidos sem categoria principal", () => {
    const resultado = validarClassificacaoSuporte({ subcategoria: "B - ALARMES" });
    expect(resultado.valido).toBe(false);
  });
});

describe("formatarCategoriaHierarquica", () => {
  it("junta os 3 níveis com ' > '", () => {
    expect(
      formatarCategoriaHierarquica({
        categoriaPrincipal: "3 - ATIVAÇÃO",
        subcategoria: "B - ALARMES",
        detalhamento: "B2 - TESTE FÍSICO",
      })
    ).toBe("3 - ATIVAÇÃO > B - ALARMES > B2 - TESTE FÍSICO");
  });

  it("omite níveis vazios", () => {
    expect(formatarCategoriaHierarquica({ categoriaPrincipal: "A - TREINAMENTO" })).toBe("A - TREINAMENTO");
    expect(
      formatarCategoriaHierarquica({ categoriaPrincipal: "1 - MOS", subcategoria: "A - APLICATIVOS" })
    ).toBe("1 - MOS > A - APLICATIVOS");
  });
});

describe("obterRotuloCategoriaExibicao — compatibilidade com registros antigos", () => {
  it("usa a hierarquia nova quando categoriaPrincipal está preenchido", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: "3 - ATIVAÇÃO",
      subcategoria: "B - ALARMES",
      detalhamento: "B2 - TESTE FÍSICO",
      categoria: "3 - ATIVAÇÃO > B - ALARMES > B2 - TESTE FÍSICO",
    });
    expect(texto).toBe("3 - ATIVAÇÃO > B - ALARMES > B2 - TESTE FÍSICO");
  });

  it("cai para o categoria legado quando não há classificação hierárquica", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: null,
      subcategoria: null,
      detalhamento: null,
      categoria: "MOS",
    });
    expect(texto).toBe("MOS");
  });
});
