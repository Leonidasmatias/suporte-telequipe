import { describe, it, expect } from "vitest";
import {
  obterCategoriasPrincipais,
  obterSubcategorias,
  obterDetalhamentos,
  validarClassificacaoSuporte,
  formatarCategoriaHierarquica,
  categoriaPrincipalValida,
  obterRotuloCategoriaExibicao,
  obterClassificacaoAtualValida,
} from "@/lib/categoriasSuporte";

// Este módulo é TypeScript puro (não importa Prisma nem Next), então os
// testes rodam direto contra as funções reais, sem nenhum mock.
//
// Missão "Refatoração da Categoria do Atendimento — eliminação do campo
// Projeto duplicado" (TELEQUIPE SUPORTE STA v7.3): o nível "Projeto"
// (antes IEZ/ERICSSON/HUAWEI/NOKIA/ZTE, um Fabricante) foi COMPLETAMENTE
// REMOVIDO da hierarquia de Categoria do Atendimento — decisão explícita do
// usuário para existir um único campo "Projeto" no sistema (a matriz oficial
// Projeto × Regional, ver lib/projetoRegional.ts). A hierarquia agora tem
// só 3 níveis: Categoria Principal → Subcategoria → Detalhamento, com 5
// Categorias Principais (MOS, Infraestrutura, Instalação, Ativação,
// Aceitação — Aceitação mantida por decisão explícita do usuário, mesmo não
// fazendo parte da nova lista da missão). Estes testes cobrem a nova matriz
// e a compatibilidade com qualquer registro legado (de qualquer formato
// anterior — Fabricante puro, "Fabricante > Categoria", ou uma matriz ainda
// mais antiga).

describe("obterCategoriasPrincipais", () => {
  it("retorna exatamente as 5 Categorias Principais oficiais, na ordem definida", () => {
    expect(obterCategoriasPrincipais()).toEqual(["MOS", "Infraestrutura", "Instalação", "Ativação", "Aceitação"]);
  });
});

describe("obterSubcategorias", () => {
  it("retorna as subcategorias de MOS", () => {
    expect(obterSubcategorias("MOS")).toEqual([
      "Log de Antes",
      "EHS",
      "Logística / Transportadora",
      "Material",
      "Aplicativos",
      "Orientação",
    ]);
  });

  it("retorna as subcategorias de Infraestrutura", () => {
    expect(obterSubcategorias("Infraestrutura")).toEqual([
      "Energia",
      "TX",
      "Fibra Óptica",
      "Sistema Irradiante",
      "Solo",
    ]);
  });

  it("retorna as subcategorias de Instalação", () => {
    expect(obterSubcategorias("Instalação")).toEqual(["Orientação sobre o Projeto", "Padrão de Instalação", "Hardware", "Ferramentas"]);
  });

  it("retorna as subcategorias de Ativação", () => {
    expect(obterSubcategorias("Ativação")).toEqual([
      "Configuração",
      "Alarmes",
      "Atualização SW",
      "Script / XML",
      "Orientação",
    ]);
  });

  it("retorna as subcategorias de Aceitação (mantida intacta desta missão)", () => {
    expect(obterSubcategorias("Aceitação")).toEqual([
      "Teste de Voz / Dados",
      "Alarmes",
      "Documentação / Relatório Fotográfico",
      "RSA Claro",
      "Log Depois",
    ]);
  });

  it("retorna lista vazia para Categoria Principal inexistente, vazia ou nula", () => {
    expect(obterSubcategorias("CATEGORIA-FANTASMA")).toEqual([]);
    expect(obterSubcategorias(null)).toEqual([]);
    expect(obterSubcategorias(undefined)).toEqual([]);
    expect(obterSubcategorias("")).toEqual([]);
  });
});

describe("obterDetalhamentos", () => {
  it("MOS > EHS tem detalhamentos Aplicativos/Orientações", () => {
    expect(obterDetalhamentos("MOS", "EHS")).toEqual(["Aplicativos", "Orientações"]);
  });

  it("MOS > Material tem detalhamentos OK/NOK", () => {
    expect(obterDetalhamentos("MOS", "Material")).toEqual(["OK", "NOK"]);
  });

  it("a maioria das subcategorias de MOS não tem detalhamento (lista vazia)", () => {
    expect(obterDetalhamentos("MOS", "Log de Antes")).toEqual([]);
    expect(obterDetalhamentos("MOS", "Logística / Transportadora")).toEqual([]);
    expect(obterDetalhamentos("MOS", "Aplicativos")).toEqual([]);
    expect(obterDetalhamentos("MOS", "Orientação")).toEqual([]);
  });

  it("Infraestrutura > Fibra Óptica tem detalhamentos Alarmes/FO NOK", () => {
    expect(obterDetalhamentos("Infraestrutura", "Fibra Óptica")).toEqual(["Alarmes", "FO NOK"]);
  });

  it("Instalação > Hardware é a única subcategoria de Instalação com detalhamento", () => {
    expect(obterDetalhamentos("Instalação", "Hardware")).toEqual(["Avarias", "Falhas"]);
    expect(obterDetalhamentos("Instalação", "Orientação sobre o Projeto")).toEqual([]);
    expect(obterDetalhamentos("Instalação", "Padrão de Instalação")).toEqual([]);
    expect(obterDetalhamentos("Instalação", "Ferramentas")).toEqual([]);
  });

  it("Ativação > Configuração e Ativação > Alarmes têm detalhamento; as demais subcategorias de Ativação não têm", () => {
    expect(obterDetalhamentos("Ativação", "Configuração")).toEqual(["Controladora", "Periféricos", "Energia"]);
    expect(obterDetalhamentos("Ativação", "Alarmes")).toEqual(["Configuração", "Teste Físico"]);
    expect(obterDetalhamentos("Ativação", "Atualização SW")).toEqual([]);
    expect(obterDetalhamentos("Ativação", "Script / XML")).toEqual([]);
    expect(obterDetalhamentos("Ativação", "Orientação")).toEqual([]);
  });

  it("Aceitação > Documentação / Relatório Fotográfico tem detalhamentos QC/RFA (mantido intacto)", () => {
    expect(obterDetalhamentos("Aceitação", "Documentação / Relatório Fotográfico")).toEqual(["QC", "RFA"]);
  });

  it("retorna lista vazia quando a subcategoria não pertence à Categoria Principal informada", () => {
    expect(obterDetalhamentos("MOS", "Sistema Irradiante")).toEqual([]);
  });

  it("retorna lista vazia para combinação inexistente ou vazia", () => {
    expect(obterDetalhamentos("MOS", null)).toEqual([]);
    expect(obterDetalhamentos(null, "Material")).toEqual([]);
  });
});

describe("validarClassificacaoSuporte", () => {
  it("aceita MOS > Material > NOK", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "MOS",
      subcategoria: "Material",
      detalhamento: "NOK",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita Ativação > Configuração > Controladora", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "Ativação",
      subcategoria: "Configuração",
      detalhamento: "Controladora",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita Infraestrutura > Fibra Óptica > FO NOK", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "Infraestrutura",
      subcategoria: "Fibra Óptica",
      detalhamento: "FO NOK",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita Aceitação > Documentação / Relatório Fotográfico > QC", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "Aceitação",
      subcategoria: "Documentação / Relatório Fotográfico",
      detalhamento: "QC",
    });
    expect(resultado.valido).toBe(true);
  });

  it("aceita apenas a Categoria Principal, sem Subcategoria", () => {
    expect(validarClassificacaoSuporte({ categoriaPrincipal: "MOS" }).valido).toBe(true);
    expect(validarClassificacaoSuporte({ categoriaPrincipal: "Instalação" }).valido).toBe(true);
  });

  it("aceita subcategoria sem detalhamento quando a subcategoria não tem detalhamentos", () => {
    expect(
      validarClassificacaoSuporte({ categoriaPrincipal: "MOS", subcategoria: "Log de Antes" }).valido
    ).toBe(true);
  });

  it("aceita tudo vazio (nenhuma nova classificação escolhida — preserva legado na edição)", () => {
    const resultado = validarClassificacaoSuporte({});
    expect(resultado.valido).toBe(true);
  });

  it("rejeita Categoria Principal desconhecida", () => {
    const resultado = validarClassificacaoSuporte({ categoriaPrincipal: "CATEGORIA-FANTASMA" });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita combinação inválida de categoria/subcategoria (MOS + Sistema Irradiante)", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "MOS",
      subcategoria: "Sistema Irradiante",
    });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.erro).toContain("não pertence");
  });

  it("rejeita detalhamento fora da subcategoria (MOS + Material + Controladora)", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "MOS",
      subcategoria: "Material",
      detalhamento: "Controladora",
    });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita Subcategoria/Detalhamento preenchidos sem Categoria Principal", () => {
    const resultado = validarClassificacaoSuporte({ subcategoria: "Material" });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita detalhamento preenchido sem subcategoria", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "MOS",
      detalhamento: "OK",
    });
    expect(resultado.valido).toBe(false);
  });

  it("rejeita detalhamento em subcategoria que não tem nenhum detalhamento (MOS + Log de Antes + qualquer coisa)", () => {
    const resultado = validarClassificacaoSuporte({
      categoriaPrincipal: "MOS",
      subcategoria: "Log de Antes",
      detalhamento: "Qualquer",
    });
    expect(resultado.valido).toBe(false);
  });
});

describe("formatarCategoriaHierarquica", () => {
  it("junta os 3 níveis com ' > '", () => {
    expect(
      formatarCategoriaHierarquica({
        categoriaPrincipal: "MOS",
        subcategoria: "Material",
        detalhamento: "NOK",
      })
    ).toBe("MOS > Material > NOK");
  });

  it("omite níveis vazios", () => {
    expect(formatarCategoriaHierarquica({ categoriaPrincipal: "MOS" })).toBe("MOS");
    expect(
      formatarCategoriaHierarquica({ categoriaPrincipal: "Ativação", subcategoria: "Script / XML" })
    ).toBe("Ativação > Script / XML");
    expect(formatarCategoriaHierarquica({})).toBe("");
  });
});

describe("categoriaPrincipalValida — único mecanismo de compatibilidade com registros antigos", () => {
  it("reconhece cada uma das 5 Categorias Principais atuais", () => {
    for (const nome of obterCategoriasPrincipais()) {
      expect(categoriaPrincipalValida(nome)).toBe(nome);
    }
  });

  it("devolve null para valor vazio/nulo/indefinido (nunca classificado)", () => {
    expect(categoriaPrincipalValida(null)).toBeNull();
    expect(categoriaPrincipalValida(undefined)).toBeNull();
    expect(categoriaPrincipalValida("")).toBeNull();
  });

  it("devolve null para um valor da matriz anterior com Projeto/Fabricante embutido (ex.: 'NOKIA', 'NOKIA > MOS')", () => {
    expect(categoriaPrincipalValida("NOKIA")).toBeNull();
    expect(categoriaPrincipalValida("NOKIA > MOS")).toBeNull();
    expect(categoriaPrincipalValida("IEZ > Dia de Integração")).toBeNull();
  });

  it("devolve null para qualquer valor de uma matriz ainda mais antiga (ex.: '3 - ATIVAÇÃO')", () => {
    expect(categoriaPrincipalValida("3 - ATIVAÇÃO")).toBeNull();
  });

  it("devolve null para uma Categoria Principal desconhecida", () => {
    expect(categoriaPrincipalValida("CATEGORIA-FANTASMA")).toBeNull();
  });
});

describe("obterRotuloCategoriaExibicao — compatibilidade com registros antigos (histórico intacto)", () => {
  it("usa a hierarquia nova completa quando categoriaPrincipal é uma das 5 Categorias atuais", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: "MOS",
      subcategoria: "Material",
      detalhamento: "NOK",
      categoria: "MOS > Material > NOK",
    });
    expect(texto).toBe("MOS > Material > NOK");
  });

  it("cai para o texto legado quando categoriaPrincipal nunca foi classificado", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: null,
      subcategoria: null,
      detalhamento: null,
      categoria: "MOS",
    });
    expect(texto).toBe("MOS");
  });

  it("um atendimento salvo com a matriz anterior (Fabricante embutido, ex.: 'NOKIA > MOS') continua exibindo seu texto legado intacto — não é migrado nem apagado", () => {
    const texto = obterRotuloCategoriaExibicao({
      categoriaPrincipal: "NOKIA > MOS",
      subcategoria: "Material",
      detalhamento: "NOK",
      categoria: "NOKIA > MOS > Material > NOK",
    });
    expect(texto).toBe("NOKIA > MOS > Material > NOK");
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
  it("reconstrói Categoria + Subcategoria + Detalhamento de um atendimento novo, totalmente classificado", () => {
    expect(
      obterClassificacaoAtualValida({
        categoriaPrincipal: "MOS",
        subcategoria: "Material",
        detalhamento: "NOK",
      })
    ).toEqual({ categoriaPrincipal: "MOS", subcategoria: "Material", detalhamento: null });
  });

  it("aceita subcategoria válida sem detalhamento (subcategoria sem detalhamentos, ex.: MOS > Log de Antes)", () => {
    expect(
      obterClassificacaoAtualValida({
        categoriaPrincipal: "MOS",
        subcategoria: "Log de Antes",
        detalhamento: null,
      })
    ).toEqual({ categoriaPrincipal: "MOS", subcategoria: "Log de Antes", detalhamento: null });
  });

  it("descarta um detalhamento salvo que não pertence mais à combinação atual", () => {
    expect(
      obterClassificacaoAtualValida({
        categoriaPrincipal: "MOS",
        subcategoria: "Log de Antes",
        detalhamento: "Qualquer",
      })
    ).toEqual({ categoriaPrincipal: "MOS", subcategoria: "Log de Antes", detalhamento: null });
  });

  it("devolve null para um atendimento salvo com a matriz anterior (Fabricante embutido, ex.: 'NOKIA > MOS'), agora legado", () => {
    expect(
      obterClassificacaoAtualValida({
        categoriaPrincipal: "NOKIA > MOS",
        subcategoria: "Material",
        detalhamento: "NOK",
      })
    ).toBeNull();
  });

  it("devolve null para um atendimento nunca classificado ou classificado por uma matriz ainda mais antiga", () => {
    expect(
      obterClassificacaoAtualValida({ categoriaPrincipal: null, subcategoria: null, detalhamento: null })
    ).toBeNull();
    expect(
      obterClassificacaoAtualValida({ categoriaPrincipal: "3 - ATIVAÇÃO", subcategoria: null, detalhamento: null })
    ).toBeNull();
  });
});
