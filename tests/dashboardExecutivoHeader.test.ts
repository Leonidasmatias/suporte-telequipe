import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Sprint v7.2 — ÚLTIMA REVISÃO.
 *
 * Este projeto não usa jsdom/Testing Library (ver nota em tests/menu.test.ts:
 * os testes de UI aqui sempre verificam os DADOS por trás da renderização,
 * não o DOM renderizado). Para os itens da missão que pedem para validar a
 * PRESENÇA de um texto/botão específico no cabeçalho do Dashboard — algo que
 * só existe como marcação JSX, sem lógica pura equivalente — a verificação
 * é feita lendo o código-fonte de `app/suporte/dashboard/page.tsx` (mesmo
 * arquivo que será renderizado pelo Next) e confirmando que os elementos
 * exigidos estão de fato presentes na árvore, e que a rota usa o recurso de
 * autorização correto. Isso é deliberadamente mais simples que introduzir uma
 * dependência de teste de DOM inteiramente nova só para esta sprint pontual
 * — o que violaria "não ampliar o escopo além desses três pontos".
 */

const codigoFontePagina = readFileSync(
  join(__dirname, "..", "app", "suporte", "dashboard", "page.tsx"),
  "utf-8"
);

describe("Cabeçalho do Dashboard Executivo — Sprint v7.2 ÚLTIMA REVISÃO", () => {
  it("o botão 'Atualizar Dashboard' está presente", () => {
    expect(codigoFontePagina).toContain("Atualizar Dashboard");
  });

  it("o texto 'Última atualização' está presente", () => {
    expect(codigoFontePagina).toContain("Última atualização");
  });

  it("o botão 'Atualizar Dashboard' é um link para a própria rota, preservando a query string reconstruída de searchParams (não um <form> nem um Client Component com router.refresh)", () => {
    expect(codigoFontePagina).toContain("hrefAtualizar");
    expect(codigoFontePagina).toContain("construirQueryStringAtual(searchParams)");
    expect(codigoFontePagina).toMatch(/<Link\s+href=\{hrefAtualizar\}/);
  });

  it("não usa polling nem atualização automática (sem setInterval/setTimeout, e permanece um Server Component puro — sem 'use client'/useRouter, o que por si só já impede um router.refresh() real aqui)", () => {
    expect(codigoFontePagina).not.toContain("setInterval");
    expect(codigoFontePagina).not.toContain("setTimeout");
    expect(codigoFontePagina).not.toContain('"use client"');
    expect(codigoFontePagina).not.toContain("useRouter");
  });

  it("a rota do Dashboard usa RECURSOS.dashboardExecutivo, não RECURSOS.relatorios", () => {
    expect(codigoFontePagina).toContain("requireAccess(RECURSOS.dashboardExecutivo)");
    expect(codigoFontePagina).not.toContain("requireAccess(RECURSOS.relatorios)");
  });
});
