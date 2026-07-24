import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * MissÃ£o "TELEQUIPE SUPORTE STA â€” EvoluÃ§Ã£o 7.1", itens 11 (logotipo) e 2
 * (versÃ£o centralizada).
 *
 * Este projeto nÃ£o usa jsdom/Testing Library (ver nota em
 * tests/dashboardExecutivoHeader.test.ts) â€” a verificaÃ§Ã£o Ã© feita lendo o
 * cÃ³digo-fonte de `components/Sidebar.tsx` (mesmo arquivo que o Next
 * renderiza) e confirmando que os elementos exigidos estÃ£o de fato
 * presentes, e testando diretamente `lib/versaoSistema.ts` (mÃ³dulo puro).
 */

const codigoFonteSidebar = readFileSync(join(__dirname, "..", "components", "Sidebar.tsx"), "utf-8");

describe("Sidebar â€” logotipo TELEQUIPE no lugar do bloco 'T' (item 11)", () => {
  it("usa o componente Image do Next.js (nÃ£o uma <img> comum)", () => {
    expect(codigoFonteSidebar).toContain('import Image from "next/image"');
    expect(codigoFonteSidebar).toMatch(/<Image[\s\S]*?\/>/);
  });

  it("aponta para o arquivo real do logotipo jÃ¡ presente no repositÃ³rio (public/images/logo-telequipe.png)", () => {
    expect(codigoFonteSidebar).toContain('src="/images/logo-telequipe.png"');
  });

  it('define alt="TELEQUIPE", width, height e priority (carregamento acima da dobra)', () => {
    expect(codigoFonteSidebar).toContain('alt="TELEQUIPE"');
    expect(codigoFonteSidebar).toMatch(/width=\{?36\}?/);
    expect(codigoFonteSidebar).toMatch(/height=\{?36\}?/);
    expect(codigoFonteSidebar).toContain("priority");
  });

  it("usa object-contain, para nunca deformar a imagem", () => {
    expect(codigoFonteSidebar).toContain("object-contain");
  });

  it("o antigo bloco com a letra solta 'T' foi removido", () => {
    expect(codigoFonteSidebar).not.toMatch(/>\s*T\s*<\/div>/);
  });

  it("mantÃ©m o texto institucional ao lado do logotipo (TELEQUIPE SUPORTE / STA / Projetos e Telecomunicações)", () => {
    expect(codigoFonteSidebar).toContain("TELEQUIPE SUPORTE");
    expect(codigoFonteSidebar).toContain("STA");
    expect(codigoFonteSidebar).toContain("Projetos e Telecomunicações");
  });
});

describe("Sidebar â€” versÃ£o exibida via constante centralizada (item 2)", () => {
  it("nÃ£o hardcoda mais 'v7.0' â€” usa a constante VERSAO_EXIBICAO de lib/versaoSistema.ts", () => {
    expect(codigoFonteSidebar).not.toContain("v7.0");
    expect(codigoFonteSidebar).toContain('import { VERSAO_EXIBICAO } from "@/lib/versaoSistema"');
    expect(codigoFonteSidebar).toContain("{VERSAO_EXIBICAO}");
  });
});

describe("lib/versaoSistema â€” fonte Ãºnica da versÃ£o exibida", () => {
  it("expÃµe a versÃ£o 7.1, sem espalhar o nÃºmero em vÃ¡rios componentes", async () => {
    const { VERSAO_SISTEMA, VERSAO_EXIBICAO, NOME_SISTEMA } = await import("@/lib/versaoSistema");
    expect(VERSAO_SISTEMA).toBe("7.3");
    expect(VERSAO_EXIBICAO).toBe("v7.3");
    expect(NOME_SISTEMA).toBe("TELEQUIPE SUPORTE STA");
  });
});



