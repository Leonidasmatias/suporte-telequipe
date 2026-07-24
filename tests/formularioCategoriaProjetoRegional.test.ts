import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Missão "Unificação visual Projeto/Regional no bloco Categoria do
 * atendimento" (TELEQUIPE SUPORTE STA v7.3).
 *
 * Este projeto não usa jsdom/Testing Library (ver nota em
 * tests/dashboardExecutivoHeader.test.ts) — a verificação de que os campos
 * Projeto e Regional foram reposicionados visualmente para dentro do bloco
 * "Categoria do atendimento", na ordem correta e sem duplicação, é feita
 * lendo o código-fonte real de app/suporte/novo/page.tsx e
 * app/suporte/[id]/page.tsx (mesmos arquivos que o Next renderiza).
 *
 * As regras de negócio da matriz Projeto x Regional em si (item 4 da lista
 * de testes da missão — "seletor dinâmico continua usando a matriz
 * centralizada") já são cobertas por tests/projetoRegional.test.ts; aqui só
 * confirmamos que os componentes de formulário continuam importando dessa
 * mesma fonte única, sem duplicar a matriz.
 */

const paginaNova = readFileSync(join(__dirname, "..", "app", "suporte", "novo", "page.tsx"), "utf-8");
const paginaEdicao = readFileSync(join(__dirname, "..", "app", "suporte", "[id]", "page.tsx"), "utf-8");
const seletorProjetoRegional = readFileSync(join(__dirname, "..", "components", "SeletorProjetoRegional.tsx"), "utf-8");
const seletorCategoriaSuporte = readFileSync(join(__dirname, "..", "components", "SeletorCategoriaSuporte.tsx"), "utf-8");
const actions = readFileSync(join(__dirname, "..", "app", "suporte", "actions.ts"), "utf-8");

/** Extrai o trecho do bloco "Categoria do atendimento" (do rótulo até o </div> de fechamento do bloco, aproximado pelo próximo "Descrição do problema"). */
function extrairBlocoCategoria(codigoFonte: string): string {
  const inicio = codigoFonte.indexOf('Categoria do atendimento');
  const fim = codigoFonte.indexOf('Descrição do problema');
  expect(inicio).toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(inicio);
  return codigoFonte.slice(inicio, fim);
}

describe.each([
  ["novo (criação)", paginaNova],
  ["[id] (edição)", paginaEdicao],
])("Formulário de atendimento — %s: Projeto/Regional unificados na Categoria do atendimento", (_nome, codigoFontePagina) => {
  it("1. Projeto e Regional (SeletorProjetoRegional) e Categoria/Subcategoria/Detalhamento (SeletorCategoriaSuporte) estão dentro do mesmo bloco 'Categoria do atendimento'", () => {
    const bloco = extrairBlocoCategoria(codigoFontePagina);
    expect(bloco).toContain("<SeletorProjetoRegional");
    expect(bloco).toContain("<SeletorCategoriaSuporte");
  });

  it("2. o campo Projeto/Regional não aparece duplicado fora do bloco (SeletorProjetoRegional ocorre exatamente 1 vez no arquivo)", () => {
    const ocorrencias = codigoFontePagina.split("<SeletorProjetoRegional").length - 1;
    expect(ocorrencias).toBe(1);
  });

  it("3. a ordem lógica é Projeto/Regional antes de Categoria Principal/Subcategoria/Detalhamento", () => {
    const bloco = extrairBlocoCategoria(codigoFontePagina);
    const posicaoProjetoRegional = bloco.indexOf("<SeletorProjetoRegional");
    const posicaoCategoria = bloco.indexOf("<SeletorCategoriaSuporte");
    expect(posicaoProjetoRegional).toBeGreaterThan(-1);
    expect(posicaoCategoria).toBeGreaterThan(posicaoProjetoRegional);
  });

  it("a linha do topo do formulário não contém mais Projeto/Regional (só Colaborador/Cliente/Site)", () => {
    const inicio = codigoFontePagina.indexOf("Colaborador");
    const fim = codigoFontePagina.indexOf("Categoria do atendimento");
    const linhaDoTopo = codigoFontePagina.slice(inicio, fim);
    expect(linhaDoTopo).not.toContain("SeletorProjetoRegional");
    expect(linhaDoTopo).toContain("Cliente");
    expect(linhaDoTopo).toContain("Site");
  });

  it("o texto auxiliar de orientação está presente no bloco unificado", () => {
    const bloco = extrairBlocoCategoria(codigoFontePagina);
    expect(bloco).toContain("Selecione primeiro o Projeto e a Regional para depois informar a Categoria, Subcategoria e Detalhamento.");
  });
});

describe("4. Seletor dinâmico continua usando a matriz centralizada (sem duplicar dados)", () => {
  it("SeletorProjetoRegional importa a matriz de lib/projetoRegional.ts, sem lista própria", () => {
    expect(seletorProjetoRegional).toContain('from "@/lib/projetoRegional"');
    expect(seletorProjetoRegional).toContain("listarProjetos");
    expect(seletorProjetoRegional).toContain("listarRegionaisDoProjeto");
    expect(seletorProjetoRegional).toContain("regionalAposTrocarProjeto");
  });

  it("SeletorCategoriaSuporte (Categoria/Subcategoria/Detalhamento) permanece intocado — continua usando lib/categoriasSuporte.ts", () => {
    expect(seletorCategoriaSuporte).toContain('from "@/lib/categoriasSuporte"');
  });
});

describe("5. Edição preserva valores já existentes do atendimento", () => {
  it("a página de edição calcula projetoOficialAtual/regionalAtual a partir do ticket salvo e os passa como default", () => {
    expect(paginaEdicao).toContain("normalizarProjeto(ticket.projeto)");
    expect(paginaEdicao).toContain("normalizarRegional(ticket.regional)");
    expect(paginaEdicao).toContain("projetoDefault={projetoOficialAtual}");
    expect(paginaEdicao).toContain("regionalDefault={regionalAtual}");
  });
});

describe("6. Criação envia Projeto e Regional corretamente", () => {
  it("SeletorProjetoRegional usa name=\"projeto\" e name=\"regional\" (lidos por app/suporte/actions.ts)", () => {
    expect(seletorProjetoRegional).toContain('name="projeto"');
    expect(seletorProjetoRegional).toContain('name="regional"');
  });

  it("o <SeletorProjetoRegional /> da página de criação está dentro do <form action={createTicket}>", () => {
    const posicaoForm = paginaNova.indexOf("action={createTicket}");
    const posicaoSeletor = paginaNova.indexOf("<SeletorProjetoRegional");
    const posicaoFimForm = paginaNova.lastIndexOf("</form>");
    expect(posicaoForm).toBeGreaterThan(-1);
    expect(posicaoSeletor).toBeGreaterThan(posicaoForm);
    expect(posicaoSeletor).toBeLessThan(posicaoFimForm);
  });
});

describe("7. Backend continua rejeitando combinações inválidas de Projeto x Regional", () => {
  it("createTicket e updateTicket continuam chamando validarProjetoRegional e lançando erro quando inválido", () => {
    const ocorrenciasValidacao = actions.split("validarProjetoRegional(projeto, regional)").length - 1;
    expect(ocorrenciasValidacao).toBe(2);
    const ocorrenciasThrow = actions.split("throw new Error(validacaoProjetoRegional.erro)").length - 1;
    expect(ocorrenciasThrow).toBe(2);
  });
});

describe("8. Atendimentos legados continuam sendo aceitos", () => {
  it("updateTicket só grava projeto/regional quando o usuário escolhe um Projeto oficial (não sobrescreve texto livre legado)", () => {
    expect(actions).toContain("let dadosProjetoRegional: { projeto?: string | null; regional?: string | null } = {};");
    expect(actions).toContain("if (projeto) {");
    expect(actions).toContain("dadosProjetoRegional = { projeto, regional };");
    expect(actions).toContain("...dadosProjetoRegional,");
  });

  it("a página de edição não tenta pré-selecionar um projeto/regional legado fora da matriz oficial (cai em string vazia)", () => {
    expect(paginaEdicao).toContain('normalizarProjeto(ticket.projeto) ?? ""');
  });
});
