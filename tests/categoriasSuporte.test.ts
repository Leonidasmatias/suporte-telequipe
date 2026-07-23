import { describe, it, expect } from "vitest";
import {
  obterProjetos,
  obterCategoriasPrincipais,
  obterSubcategorias,
  obterDetalhamentos,
  validarClassificacaoSuporte,
  formatarCategoriaHierarquica,
  combinarProjetoCategoria,
  interpretarCategoriaPrincipalPersistida,
  obterRotuloCategoriaExibicao,
  obterClassificacaoAtualValida,
} from "@/lib/categoriasSuporte";

// Este módulo é TypeScript puro (não importa Prisma nem Next), então os
// testes rodam direto contra as funções reais, sem nenhum mock.
//
// Missão "TELEQUIPE SUPORTE STA v7.1 — Correção da Matriz — IEZ deve
// replicar os demais projetos": a primeira versão da revisão v7.1 tinha dado
// ao Projeto IEZ uma estrutura EXCLUSIVA ("Dia de Integração" com 7
// subcategorias próprias). Esta correção descarta completamente essa
// estrutura exclusiva: os 5 Projetos (ERICSSON, HUAWEI, NOKIA, ZTE, IEZ)
// agora compartilham exatamente a mesma matriz operacional de 5 Categorias
// Principais (MOS, Infraestrutura, Instalação, Ativação, Aceitação). Estes
// testes cobrem essa nova regra e a compatibilidade com qualquer registro
// legado — inclusive os que tenham sido classificados com a estrutura
// exclusiva do IEZ durante a implementação anterior desta mesma sprint.

describe("obterProjetos", () => {
  it("retorna exatamente os 5 Projetos oficiais, na ordem definida", () => {
    expect(obterProjetos()).toEqual(["ERICSSON", "HUAWEI", "NOKIA", "ZTE", "IEZ"]);
  });
});

describe("obterCategoriasPrincipais", () => {
  it("IEZ apresenta EXATAMENTE as mesmas 5 Categorias Principais dos demais projetos (correção desta missão)", () => {
    const esperado = ["MOS", "Infraestrutura", "Instalação", "Ativação", "Aceitação"];
    expect(obterCategoriasPrincipais("IEZ")).toEqual(esperado);
  });

  it("todos os 5 projetos (ERICSSON/HUAWEI/NOKIA/ZTE/IEZ) reutilizam a mesma matriz operacional", () => {
    const esperado = ["MOS", "Infraestrutura", "Instalação", "Ativação", "Aceitação"];
    for (const projeto of obterProjetos()) {
      expect(obterCategoriasPrincipais(projeto)).toEqual(esperado);
    }
  });

  it("IEZ não tem mais nenhuma categoria exclusiva antiga (ex.: 'Dia de Integração')", () => {
    expect(obterCategoriasPrincipais("IEZ")).not.toContain("Dia de Integração");
  });

  it("retorna lista vazia para Projeto inexistente, vazio ou nulo", () => {
    expect(obterCategoriasPrincipais("PROJETO-FANTASMA")).toEqual([]);
    expect(obterCategoriasPrincipais(null)).toEqual([]);
    expect(obterCategoriasPrincipais(undefined)).toEqual([]);
    expect(obterCategoriasPrincipais("")).toEqual([]);
  });
});

describe("obterSubcategorias", () => {
  it("IEZ > MOS tem as mesmas subcategorias que qualquer outro projeto > MOS", () => {
    const esperado = ["Log de Antes", "EHS", "Logística / Transportadora", "Material", "Aplicativos", "Orientação"];
    expect(obterSubcategorias("IEZ", "MOS")).toEqual(esperado);
    expect(obterSubcategorias("NOKIA", "MOS")).toEqual(esperado);
  });

  it("retorna as subcategorias de ERICSSON > Infraestrutura", () => {
    expect(obterSubcategorias("ERICSSON", "Infraestrutura")).toEqual([
      "Energia",
      "TX",
      "Fibra Óptica",
      "Sistema Irradiante",
      "Solo",
    ]);
  });

  it("retorna lista vazia para 'Dia de Integração' em qualquer projeto (categoria exclusiva antiga, descartada)", () => {
    expect(obterSubcategorias("IEZ", "Dia de Integração")).toEqual([]);
    expect(obterSubcategorias("NOKIA", "Dia de Integração")).toEqual([]);
  });

  it("retorna lista vazia para Projeto/Categoria inexistente, vazia, ou de uma matriz anterior", () => {
    expect(obterSubcategorias("ZTE", "X - NÃO EXISTE")).toEqual([]);
    expect(obterSubcategorias(null, "MOS")).toEqual([]);
    expect(obterSubcategorias("NOKIA", null)).toEqual([]);
  });
});

describe("obterDetalhamentos", () => {
  it("IEZ > MOS > Material tem os mesmos detalhamentos que qualquer outro projeto > MOS > Material", () => {
    expect(obterDetalhamentos("IEZ", "MOS", "Material")).toEqual(["OK", "NOK"]);
    expect(obterDetalhamentos("NOKIA", "MOS", "Material")).toEqual(["OK", "NOK"]);
  });

  it("IEZ > Ativação > Configuração tem 'Controladora' (exemplo válido oficial da missão)", () => {
    expect(obterDetalhamentos("IEZ", "Ativação", "Configuração")).toEqual([
      "Controladora",
      "Periféricos",
      "Energia",
    ]);
  });

  it("retorna os detalhamentos de HUAWEI > Infraestrutura > Sistema Irradiante", () => {
    expect(obterDetalhamentos("HUAWEI", "Infraestrutura", "Sistema Irradiante")).toEqual([
      "Suporte",
      "Falta de Infraestrutura",
      "Esteiramento Horizontal / Vertical",
    ]);
  });

  it("retorna os detalhamentos de HUAWEI > Aceitação > Documentação / Relatório Fotográfico (exemplo válido oficial da missão)", () => {
    expect(obterDetalhamentos("HUAWEI", "Aceitação", "Documentação / Relatório Fotográfico")).toEqual([
      "QC",
      "RFA",
    ]);
  });

  it("retorna os detalhamentos de NOKIA > Infraestrutura > Fibra Óptica (exemplo válido oficial da missão)", () => {
    expect(obterDetalhamentos("NOKIA", "Infraestrutura", "Fibra Óptica")).toEqual(["Alarmes", "FO NOK"]);
  });

  it("retorna lista vazia quando a subcategoria não pertence à combinação Projeto+Categoria informada", () => {
    expect(obterDetalhamentos("IEZ", "MOS", "Sistema Irradiante")).toEqual([]);
  });

  it("retorna lista vazia para combinação inexistente ou vazia", () => {
    expect(obterDetalhamentos("NOKIA", "MOS", null)).toEqual([]);
    expect(obterDetalhamentos("NOKIA", null, "Material")).toEqual([]);
    expect(obterDetalhamentos(null, "MOS", "Material")).toEqual([]);
  });
});

describe("validarClassificacaoSuporte", () => {
  it("IEZ aceita MOS > Material > NOK (exemplo válido oficial da missão)", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "IEZ",
      categoriaPrincipal: "MOS",
      subcategoria: "Material",
      detalhamento: "NOK",
    });
    expect(resultado.valido).toBe(true);
  });

  it("IEZ aceita Ativação > Configuração > Controladora (exemplo válido oficial da missão)", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "IEZ",
      categoriaPrincipal: "Ativação",
      subcategoria: "Configuração",
      detalhamento: "Controladora",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita NOKIA > Infraestrutura > Fibra Óptica > FO NOK (exemplo válido oficial da missão)", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "NOKIA",
      categoriaPrincipal: "Infraestrutura",
      subcategoria: "Fibra Óptica",
      detalhamento: "FO NOK",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita HUAWEI > Aceitação > Documentação / Relatório Fotográfico > QC (exemplo válido oficial da missão)", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "HUAWEI",
      categoriaPrincipal: "Aceitação",
      subcategoria: "Documentação / Relatório Fotográfico",
      detalhamento: "QC",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita apenas o Projeto, sem Categoria Principal (qualquer um dos 5 projetos)", () => {
    expect(validarClassificacaoSuporte({ projeto: "IEZ" }).valido).toBe(true);
    expect(validarClassificacaoSuporte({ projeto: "ZTE" }).valido).toBe(true);
  });

  it("aceita tudo vazio (nenhuma nova classificação escolhida — preserva legado na edição)", () => {
    const resultado = validarClassificacaoSuporte({});
    expect(resultado.valido).toBe(true);
  });

  it("rejeita a categoria exclusiva antiga do IEZ ('Dia de Integração') — foi completamente descartada", () => {
    const resultado = validarClassificacaoSuporte({ projeto: "IEZ", categoriaPrincipal: "Dia de Integração" });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.erro).toContain("não pertence ao Projeto");
  });

  it("rejeita qualquer subcategoria exclusiva antiga do IEZ (ex.: 'Treinamentos TELEQUIPE') sob a categoria 'Dia de Integração'", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "IEZ",
      categoriaPrincipal: "Dia de Integração",
      subcategoria: "Treinamentos TELEQUIPE",
    });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita combinação inválida de categoria/subcategoria (IEZ + MOS + Sistema Irradiante)", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "IEZ",
      categoriaPrincipal: "MOS",
      subcategoria: "Sistema Irradiante",
    });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.erro).toContain("não pertence");
  });

  it("rejeita detalhamento fora da subcategoria (NOKIA + MOS + Material + Controladora)", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "NOKIA",
      categoriaPrincipal: "MOS",
      subcategoria: "Material",
      detalhamento: "Controladora",
    });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita Projeto desconhecido", () => {
    const resultado = validarClassificacaoSuporte({ projeto: "PROJETO-FANTASMA" });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita Categoria Principal preenchida sem Projeto", () => {
    const resultado = validarClassificacaoSuporte({ categoriaPrincipal: "MOS" });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita subcategoria/detalhamento preenchidos sem Categoria Principal", () => {
    const resultado = validarClassificacaoSuporte({ projeto: "NOKIA", subcategoria: "Material" });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita detalhamento preenchido sem subcategoria", () => {
    const resultado = validarClassificacaoSuporte({
      projeto: "NOKIA",
      categoriaPrincipal: "MOS",
      detalhamento: "OK",
    });
    expect(resultado.valido).toBe(false);
  });
});

describe("formatarCategoriaHierarquica", () => {
  it("junta os 4 níveis com ' > ' para o Projeto IEZ igual a qualquer outro projeto", () => {
    expect(
      formatarCategoriaHierarquica({
        projeto: "IEZ",
        categoriaPrincipal: "MOS",
        subcategoria: "Material",
        detalhamento: "NOK",
      })
    ).toBe("IEZ > MOS > Material > NOK");
  });

  it("omite níveis vazios", () => {
    expect(formatarCategoriaHierarquica({ projeto: "IEZ" })).toBe("IEZ");
    expect(
      formatarCategoriaHierarquica({ projeto: "ZTE", categoriaPrincipal: "Ativação", subcategoria: "Script / XML" })
    ).toBe("ZTE > Ativação > Script / XML");
  });
});

describe("combinarProjetoCategoria — codificação para a coluna categoriaPrincipal (sem alterar o schema)", () => {
  it("devolve null quando nenhum Projeto foi escolhido", () => {
    expect(combinarProjetoCategoria(null, null)).toBeNull();
    expect(combinarProjetoCategoria(undefined, "MOS")).toBeNull();
  });

  it("devolve o Projeto puro quando só ele foi escolhido", () => {
    expect(combinarProjetoCategoria("IEZ", null)).toBe("IEZ");
  });

  it("devolve o composto 'Projeto > Categoria' quando os dois foram escolhidos, igual para IEZ e para os demais projetos", () => {
    expect(combinarProjetoCategoria("IEZ", "MOS")).toBe("IEZ > MOS");
    expect(combinarProjetoCategoria("NOKIA", "MOS")).toBe("NOKIA > MOS");
  });
});

describe("interpretarCategoriaPrincipalPersistida — decodificação, só reconhece a matriz atual", () => {
  it("decodifica um Projeto puro salvo (só Projeto escolhido) — inclusive IEZ", () => {
    expect(interpretarCategoriaPrincipalPersistida("IEZ")).toEqual({ projeto: "IEZ", categoriaPrincipal: null });
  });

  it("decodifica um composto válido 'IEZ > Categoria' igual a qualquer outro projeto", () => {
    expect(interpretarCategoriaPrincipalPersistida("IEZ > MOS")).toEqual({
      projeto: "IEZ",
      categoriaPrincipal: "MOS",
    });
    expect(interpretarCategoriaPrincipalPersistida("NOKIA > MOS")).toEqual({
      projeto: "NOKIA",
      categoriaPrincipal: "MOS",
    });
  });

  it("devolve null para valor vazio/nulo (nunca classificado)", () => {
    expect(interpretarCategoriaPrincipalPersistida(null)).toBeNull();
    expect(interpretarCategoriaPrincipalPersistida(undefined)).toBeNull();
    expect(interpretarCategoriaPrincipalPersistida("")).toBeNull();
  });

  it("devolve null para uma Categoria Principal 'solta' de uma matriz anterior (sem Projeto, ex.: 'MOS' sozinho)", () => {
    expect(interpretarCategoriaPrincipalPersistida("MOS")).toBeNull();
  });

  it("devolve null para 'IEZ > Dia de Integração' — a estrutura EXCLUSIVA que o IEZ chegou a ter na primeira versão desta revisão, agora completamente descartada", () => {
    expect(interpretarCategoriaPrincipalPersistida("IEZ > Dia de Integração")).toBeNull();
  });

  it("devolve null para qualquer valor de uma matriz ainda mais antiga (ex.: '3 - ATIVAÇÃO')", () => {
    expect(interpretarCategoriaPrincipalPersistida("3 - ATIVAÇÃO")).toBeNull();
  });

  it("devolve null para um Projeto inexistente combinado com qualquer Categoria", () => {
    expect(interpretarCategoriaPrincipalPersistida("PROJETO-FANTASMA > MOS")).toBeNull();
  });
});

describe("obterRotuloCategoriaExibicao — compatibilidade com registros antigos (histórico intacto)", () => {
  it("usa a hierarquia nova completa quando categoriaPrincipal é decodificável, para IEZ igual a qualquer outro projeto", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: "IEZ > MOS",
      subcategoria: "Material",
      detalhamento: "NOK",
      categoria: "IEZ > MOS > Material > NOK",
    });
    expect(texto).toBe("IEZ > MOS > Material > NOK");
  });

  it("cai para o categoria legado quando nunca houve classificação hierárquica", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: null,
      subcategoria: null,
      detalhamento: null,
      categoria: "MOS",
    });
    expect(texto).toBe("MOS");
  });

  it("um atendimento criado durante a implementação anterior do IEZ (estrutura exclusiva 'Dia de Integração') continua exibindo seu texto legado intacto — não é migrado nem apagado", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: "IEZ > Dia de Integração",
      subcategoria: "Treinamentos TELEQUIPE",
      detalhamento: "Geral",
      categoria: "IEZ > Dia de Integração > Treinamentos TELEQUIPE > Geral",
    });
    expect(texto).toBe("IEZ > Dia de Integração > Treinamentos TELEQUIPE > Geral");
  });

  it("um atendimento salvo com uma matriz ainda mais antiga (ex.: '3 - ATIVAÇÃO') continua exibindo seu texto legado intacto", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: "3 - ATIVAÇÃO",
      subcategoria: "B - ALARMES",
      detalhamento: "B2 - TESTE FÍSICO",
      categoria: "3 - ATIVAÇÃO > B - ALARMES > B2 - TESTE FÍSICO",
    });
    expect(texto).toBe("3 - ATIVAÇÃO > B - ALARMES > B2 - TESTE FÍSICO");
  });
});

describe("obterClassificacaoAtualValida — reconstrói os defaults do formulário de edição", () => {
  it("reconstrói Projeto + Categoria + Subcategoria + Detalhamento de um atendimento IEZ novo, totalmente classificado", () => {
    expect(
      obterClassificacaoAtualValida({
        categoriaPrincipal: "IEZ > MOS",
        subcategoria: "Material",
        detalhamento: "NOK",
      })
    ).toEqual({ projeto: "IEZ", categoriaPrincipal: "MOS", subcategoria: "Material", detalhamento: "NOK" });
  });

  it("devolve null para um atendimento criado durante a implementação anterior do IEZ (estrutura exclusiva, agora legada)", () => {
    expect(
      obterClassificacaoAtualValida({
        categoriaPrincipal: "IEZ > Dia de Integração",
        subcategoria: "Treinamentos TELEQUIPE",
        detalhamento: "Geral",
      })
    ).toBeNull();
  });

  it("devolve null para um atendimento nunca classificado ou classificado por uma matriz ainda mais antiga", () => {
    expect(obterClassificacaoAtualValida({ categoriaPrincipal: null, subcategoria: null, detalhamento: null })).toBeNull();
    expect(
      obterClassificacaoAtualValida({ categoriaPrincipal: "3 - ATIVAÇÃO", subcategoria: null, detalhamento: null })
    ).toBeNull();
  });
});
