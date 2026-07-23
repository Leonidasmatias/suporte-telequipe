import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Sprint v7.2 — AJUSTE FINAL DE NAVEGAÇÃO.
 *
 * Cobre o requisito "verificar para onde o sistema direciona o usuário após
 * o login" e "aplicar o mesmo ajuste em qualquer redirecionamento automático
 * que leve o usuário autenticado para /home como página inicial": os três
 * pontos identificados no código (`app/login/actions.ts` — Server Action de
 * login, `app/login/page.tsx` — usuário já logado que visita /login,
 * `app/page.tsx` — raiz "/") agora apontam para `/suporte/dashboard`.
 *
 * Mesmo padrão de mock de tests/autorizacao.test.ts (prisma/next-headers/
 * next-navigation substituídos por stubs, sem banco/servidor real).
 */

const usuarioFindUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { usuario: { findUnique: usuarioFindUniqueMock } },
}));

let cookieAtual: string | undefined;
const cookiesGetMock = vi.fn(() => (cookieAtual !== undefined ? { value: cookieAtual } : undefined));
const cookiesSetMock = vi.fn();
const cookiesDeleteMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: cookiesGetMock,
    set: cookiesSetMock,
    delete: cookiesDeleteMock,
  }),
}));

class RedirectSinalizado extends Error {
  destino: string;
  constructor(destino: string) {
    super(`NEXT_REDIRECT:${destino}`);
    this.destino = destino;
  }
}
const redirectMock = vi.fn((destino: string) => {
  throw new RedirectSinalizado(destino);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

process.env.AUTH_SECRET = "segredo-de-teste-nao-usar-em-producao";

const { hashSenha } = await import("@/lib/senha");
const { criarTokenSessao } = await import("@/lib/auth");
const { entrar } = await import("@/app/login/actions");
const { default: LoginPage } = await import("@/app/login/page");
const { default: RootPage } = await import("@/app/page");

function usuarioValido(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    nome: "Ana Admin",
    email: "ana@empresa.com",
    perfil: "ADMIN",
    ativo: true,
    senhaHash: hashSenha("SenhaValida123"),
    ...overrides,
  };
}

beforeEach(() => {
  cookieAtual = undefined;
  usuarioFindUniqueMock.mockReset();
  redirectMock.mockClear();
  cookiesSetMock.mockClear();
});

describe("entrar (Server Action de login) — redirecionamento pós-login", () => {
  it("credenciais válidas: redireciona para /suporte/dashboard (não mais /home)", async () => {
    usuarioFindUniqueMock.mockResolvedValue(usuarioValido());
    const formData = new FormData();
    formData.set("email", "ana@empresa.com");
    formData.set("senha", "SenhaValida123");

    await expect(entrar(formData)).rejects.toThrow("NEXT_REDIRECT:/suporte/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/suporte/dashboard");
    expect(redirectMock).not.toHaveBeenCalledWith("/home");
  });

  it("mesmo destino para TECNICO (o redirecionamento pós-login não depende do perfil)", async () => {
    usuarioFindUniqueMock.mockResolvedValue(usuarioValido({ perfil: "TECNICO" }));
    const formData = new FormData();
    formData.set("email", "ana@empresa.com");
    formData.set("senha", "SenhaValida123");

    await expect(entrar(formData)).rejects.toThrow("NEXT_REDIRECT:/suporte/dashboard");
  });

  it("credenciais inválidas: não redireciona (continua na tela de login com erro)", async () => {
    usuarioFindUniqueMock.mockResolvedValue(usuarioValido());
    const formData = new FormData();
    formData.set("email", "ana@empresa.com");
    formData.set("senha", "senha-errada");

    const resultado = await entrar(formData);
    expect(resultado).toEqual({ ok: false, erro: "E-mail ou senha inválidos." });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("LoginPage — usuário já autenticado que visita /login", () => {
  it("redireciona para /suporte/dashboard (não mais /home)", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(usuarioValido({ ativo: true }));

    await expect(LoginPage()).rejects.toThrow("NEXT_REDIRECT:/suporte/dashboard");
    expect(redirectMock).not.toHaveBeenCalledWith("/home");
  });

  it("sem sessão, não redireciona (mostra o formulário de login)", async () => {
    // Este projeto não configura o transform de JSX no Vitest (nenhuma
    // sprint anterior usa jsdom/Testing Library — ver nota em
    // tests/menu.test.ts). Chamar LoginPage() sem sessão chega até o
    // `return (<jsx/>)` do formulário, que este ambiente de teste não
    // consegue construir sozinho — o que importa aqui é só confirmar que
    // NENHUM redirect foi disparado antes disso (o comportamento relevante
    // para este requisito), por isso o erro de construção do JSX é ignorado.
    cookieAtual = undefined;
    try {
      await LoginPage();
    } catch {
      // ignorado de propósito — ver comentário acima.
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("RootPage ('/') — redirecionamento de página inicial", () => {
  it("redireciona para /suporte/dashboard (não mais /home)", () => {
    expect(() => RootPage()).toThrow("NEXT_REDIRECT:/suporte/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/suporte/dashboard");
    expect(redirectMock).not.toHaveBeenCalledWith("/home");
  });
});

describe("Rota /home — continua existindo e protegida (Sprint v7.2 — Ajuste final de navegação)", () => {
  // Este projeto não usa jsdom/Testing Library (ver nota em
  // tests/menu.test.ts e tests/dashboardExecutivoHeader.test.ts) — a página
  // /home em si (app/home/page.tsx) importa lib/imt.ts e vários componentes
  // de indicadores que exigiriam mocks extensos e não relacionados a esta
  // sprint pontual; a verificação aqui é deliberadamente uma inspeção do
  // código-fonte, confirmando que a proteção de acesso da rota não foi
  // tocada por esta sprint (ela só deixou de ter uma entrada no menu).
  const codigoFontePaginaHome = readFileSync(join(__dirname, "..", "app", "home", "page.tsx"), "utf-8");

  it("a rota /home continua chamando requireAccess(RECURSOS.dashboard), sem alteração", () => {
    expect(codigoFontePaginaHome).toContain("requireAccess(RECURSOS.dashboard)");
  });
});
