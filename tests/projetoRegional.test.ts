import { describe, it, expect } from "vitest";
import {
  PROJETO_REGIONAIS,
  listarProjetos,
  listarRegionaisDoProjeto,
  projetoAceitaRegional,
  normalizarProjeto,
  normalizarRegional,
  validarProjetoRegional,
  classificarProjetoRegionalHistorico,
  regionalAposTrocarProjeto,
  PROJETO_NAO_CLASSIFICADO,
  REGIONAL_NAO_CLASSIFICADA,
  COMBINACAO_HISTORICA,
} from "@/lib/projetoRegional";

// Este módulo é TypeScript puro (não importa Prisma nem Next), então os
// testes rodam direto contra as funções reais, sem nenhum mock — mesmo
// padrão já usado em tests/categoriasSuporte.test.ts.
//
// Missão "TELEQUIPE SUPORTE STA — Evolução 7.1": matriz oficial Projeto ×
// Regional. Estes testes cobrem exatamente os itens 1-9 e 11 da lista de
// testes obrigatórios da missão (o item 10, cascata de limpeza da Regional
// ao trocar o Projeto, é coberto separadamente por `regionalAposTrocarProjeto`
// abaixo — este projeto não usa jsdom/Testing Library, ver nota em
// tests/dashboardExecutivoHeader.test.ts, então a regra de cascata em si foi
// extraída para uma função pura testável sem simular DOM/eventos).

describe("listarProjetos", () => {
  it("retorna exatamente os 7 Projetos oficiais, na ordem definida na matriz (item 1)", () => {
    expect(listarProjetos()).toEqual([
      "ERICSSON-CLARO",
      "VIVO SIRIUS-ERICSSON",
      "NOKIA-TIM",
      "NOKIA-CLARO",
      "HUAWEI-TIM",
      "ZTE-CLARO",
      "IEZ-ZTE",
    ]);
  });

  it("a matriz PROJETO_REGIONAIS tem exatamente 7 chaves", () => {
    expect(Object.keys(PROJETO_REGIONAIS)).toHaveLength(7);
  });
});

describe("listarRegionaisDoProjeto", () => {
  it("ERICSSON-CLARO aceita exatamente SM e SI (item 2)", () => {
    expect(listarRegionaisDoProjeto("ERICSSON-CLARO")).toEqual(["SM", "SI"]);
  });

  it("VIVO SIRIUS-ERICSSON aceita exatamente SP, MG e BASE (item 3)", () => {
    expect(listarRegionaisDoProjeto("VIVO SIRIUS-ERICSSON")).toEqual(["SP", "MG", "BASE"]);
  });

  it("NOKIA-TIM aceita exatamente SP, MG e CO (item 4)", () => {
    expect(listarRegionaisDoProjeto("NOKIA-TIM")).toEqual(["SP", "MG", "CO"]);
  });

  it("NOKIA-CLARO aceita exatamente BASE e NO (item 5)", () => {
    expect(listarRegionaisDoProjeto("NOKIA-CLARO")).toEqual(["BASE", "NO"]);
  });

  it("HUAWEI-TIM aceita SOMENTE BASE (item 6)", () => {
    expect(listarRegionaisDoProjeto("HUAWEI-TIM")).toEqual(["BASE"]);
  });

  it("ZTE-CLARO aceita exatamente NO, RJ, SP e MG (item 7)", () => {
    expect(listarRegionaisDoProjeto("ZTE-CLARO")).toEqual(["NO", "RJ", "SP", "MG"]);
  });

  it("IEZ-ZTE aceita SOMENTE MG (item 8)", () => {
    expect(listarRegionaisDoProjeto("IEZ-ZTE")).toEqual(["MG"]);
  });

  it("Projeto vazio/nulo ou desconhecido devolve lista vazia", () => {
    expect(listarRegionaisDoProjeto(null)).toEqual([]);
    expect(listarRegionaisDoProjeto("")).toEqual([]);
    expect(listarRegionaisDoProjeto("PROJETO-INEXISTENTE")).toEqual([]);
  });
});

describe("projetoAceitaRegional / validarProjetoRegional — combinações inválidas são rejeitadas (item 9)", () => {
  it("HUAWEI-TIM não aceita SP (só aceita BASE)", () => {
    expect(projetoAceitaRegional("HUAWEI-TIM", "SP")).toBe(false);
    expect(validarProjetoRegional("HUAWEI-TIM", "SP")).toEqual({
      valido: false,
      erro: "A regional SP não está disponível para o projeto HUAWEI-TIM.",
    });
  });

  it("IEZ-ZTE não aceita SP (só aceita MG)", () => {
    expect(projetoAceitaRegional("IEZ-ZTE", "SP")).toBe(false);
  });

  it("Regional informada sem Projeto é inválida", () => {
    expect(validarProjetoRegional(null, "SP")).toEqual({
      valido: false,
      erro: "Selecione um projeto antes de informar a regional.",
    });
  });

  it("Projeto fora da matriz oficial é inválido (ex.: chamada direta à API contornando o <select>)", () => {
    const resultado = validarProjetoRegional("PROJETO-FANTASMA", null);
    expect(resultado.valido).toBe(false);
  });

  it("Projeto e Regional em branco continuam válidos (nenhuma obrigatoriedade nova)", () => {
    expect(validarProjetoRegional(null, null)).toEqual({ valido: true });
  });

  it("Projeto válido sem Regional é válido (Regional continua opcional)", () => {
    expect(validarProjetoRegional("NOKIA-TIM", null)).toEqual({ valido: true });
  });

  it("Combinação válida é aceita, inclusive com variação de caixa/espaço", () => {
    expect(validarProjetoRegional("nokia-tim", " sp ")).toEqual({ valido: true });
  });
});

describe("normalizarProjeto / normalizarRegional", () => {
  it("normalizarProjeto tolera variação de caixa/espaço mas devolve sempre o valor canônico", () => {
    expect(normalizarProjeto("  nokia-tim  ")).toBe("NOKIA-TIM");
    expect(normalizarProjeto("vivo sirius-ericsson")).toBe("VIVO SIRIUS-ERICSSON");
  });

  it("normalizarProjeto devolve null para texto livre legado (nome de projeto de cliente)", () => {
    expect(normalizarProjeto("Expansão 5G Regional Sul")).toBeNull();
  });

  it("normalizarRegional normaliza para maiúsculas", () => {
    expect(normalizarRegional(" sp ")).toBe("SP");
  });
});

describe("classificarProjetoRegionalHistorico — registros antigos continuam visíveis, nunca excluídos (item 13)", () => {
  it("Projeto e Regional ausentes -> Projeto não classificado / Regional não classificada", () => {
    expect(classificarProjetoRegionalHistorico(null, null)).toEqual({
      projeto: PROJETO_NAO_CLASSIFICADO,
      regional: REGIONAL_NAO_CLASSIFICADA,
    });
  });

  it("Projeto texto livre legado (fora da matriz) -> Projeto não classificado", () => {
    expect(classificarProjetoRegionalHistorico("Expansão 5G Regional Sul", null)).toEqual({
      projeto: PROJETO_NAO_CLASSIFICADO,
      regional: REGIONAL_NAO_CLASSIFICADA,
    });
  });

  it("Projeto oficial sem Regional -> Regional não classificada", () => {
    expect(classificarProjetoRegionalHistorico("NOKIA-TIM", null)).toEqual({
      projeto: "NOKIA-TIM",
      regional: REGIONAL_NAO_CLASSIFICADA,
    });
  });

  it("Projeto oficial com combinação válida -> classificação normal", () => {
    expect(classificarProjetoRegionalHistorico("NOKIA-TIM", "SP")).toEqual({ projeto: "NOKIA-TIM", regional: "SP" });
  });

  it("Projeto oficial com combinação fora da matriz ATUAL -> Combinação histórica (nunca descartado)", () => {
    expect(classificarProjetoRegionalHistorico("HUAWEI-TIM", "SP")).toEqual({
      projeto: "HUAWEI-TIM",
      regional: COMBINACAO_HISTORICA,
    });
  });
});

describe("regionalAposTrocarProjeto — cascata do formulário (item 10)", () => {
  it("Projeto com exatamente 1 Regional permitida pré-seleciona automaticamente", () => {
    expect(regionalAposTrocarProjeto("HUAWEI-TIM", "")).toBe("BASE");
    expect(regionalAposTrocarProjeto("IEZ-ZTE", "")).toBe("MG");
  });

  it("Regional atual continua válida para o novo Projeto -> mantém", () => {
    expect(regionalAposTrocarProjeto("NOKIA-TIM", "SP")).toBe("SP");
  });

  it("Regional atual deixou de ser válida para o novo Projeto -> limpa (nunca mantém combinação incompatível)", () => {
    expect(regionalAposTrocarProjeto("NOKIA-TIM", "NO")).toBe("");
    expect(regionalAposTrocarProjeto("HUAWEI-TIM", "SP")).toBe("BASE"); // única opção, sobrescreve a incompatível
  });

  it("Nenhum Projeto selecionado -> Regional sempre vazia", () => {
    expect(regionalAposTrocarProjeto("", "SP")).toBe("");
  });
});
