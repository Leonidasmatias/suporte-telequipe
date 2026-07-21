import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Etapa 3 — Revisão de auditoria: proteção do último ADMIN ativo.
 *
 * Testa app/usuarios/actions.ts diretamente (não só lib/autorizacao.ts),
 * porque a regra "não pode ficar sem nenhum ADMIN ativo" vive nessas
 * Server Actions (deleteUsuario, toggleUsuarioAtivo, updateUsuario), não na
 * camada genérica de autorização. A regra é deliberadamente baseada em uma
 * contagem no banco (prisma.usuario.count) — não em "o alvo é o próprio
 * usuário logado?" — porque a especificação exige que a proteção valha
 * também quando um ADMIN tenta alterar OUTRO ADMIN que por acaso é o
 * último ativo, e não apenas quando alguém mexe na própria conta.
 *
 * Mesma estratégia de mock de tests/autorizacao.test.ts: prisma, next/
 * headers e next/navigation são substituídos por stubs controláveis. Este
 * arquivo mocka também next/cache (revalidatePath), que autorizacao.test.ts
 * não precisa porque lib/autorizacao.ts não chama cache do Next.
 */

const usuarioFindUniqueMock = vi.fn();
const usuarioCountMock = vi.fn();
const usuarioUpdateMock = vi.fn();
const usuarioDeleteMock = vi.fn();
const usuarioCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: usuarioFindUniqueMock,
      count: usuarioCountMock,
      update: usuarioUpdateMock,
      delete: usuarioDeleteMock,
      create: usuarioCreateMock,
    },
  },
}));

let cookieAtual: string | undefined;
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => (cookieAtual !== undefined ? { value: cookieAtual } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
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

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

process.env.AUTH_SECRET = "segredo-de-teste-nao-usar-em-producao";

const { criarTokenSessao } = await import("@/lib/auth");
const { ErroSemPermissao } = await import("@/lib/autorizacao");
const { deleteUsuario, toggleUsuarioAtivo, updateUsuario } = await import("@/app/usuarios/actions");

const MSG_ULTIMO_ADMIN = "O sistema deve possuir pelo menos um administrador ativo.";

type UsuarioRegistro = {
  id: number;
  nome: string;
  email: string;
  perfil: "ADMIN" | "TECNICO";
  ativo: boolean;
};

function registroAdmin(overrides: Partial<UsuarioRegistro> = {}): UsuarioRegistro {
  return { id: 1, nome: "Ana Admin", email: "ana@empresa.com", perfil: "ADMIN", ativo: true, ...overrides };
}
function registroTecnico(overrides: Partial<UsuarioRegistro> = {}): UsuarioRegistro {
  return { id: 2, nome: "Tiago Técnico", email: "tiago@empresa.com", perfil: "TECNICO", ativo: true, ...overrides };
}

/**
 * Configura findUnique para responder de acordo com o id consultado —
 * necessário porque cada Server Action consulta o banco pelo menos duas
 * vezes por chamada: uma para resolver "quem está logado" (getUsuarioAtual,
 * via cookie) e outra para olhar os dados do "alvo" da operação
 * (operacaoDeixariaSemAdminAtivo), que podem ser usuários diferentes.
 */
function configurarBanco(registros: UsuarioRegistro[]) {
  usuarioFindUniqueMock.mockImplementation(async ({ where: { id } }: { where: { id: number } }) => {
    return registros.find((r) => r.id === id) ?? null;
  });
}

function formDataComId(id: number): FormData {
  const fd = new FormData();
  fd.append("id", String(id));
  return fd;
}

beforeEach(() => {
  cookieAtual = undefined;
  usuarioFindUniqueMock.mockReset();
  usuarioCountMock.mockReset();
  usuarioUpdateMock.mockReset();
  usuarioDeleteMock.mockReset();
  usuarioCreateMock.mockReset();
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
});

describe("Proteção do último ADMIN ativo — exclusão (deleteUsuario)", () => {
  it("bloqueia a exclusão quando o alvo é o único ADMIN ativo do sistema", async () => {
    const admin = registroAdmin();
    configurarBanco([admin]);
    usuarioCountMock.mockResolvedValue(1); // só existe 1 ADMIN ativo (o próprio alvo)
    cookieAtual = criarTokenSessao(admin.id);

    const resultado = await deleteUsuario(formDataComId(admin.id));

    expect(resultado).toEqual({ ok: false, erro: MSG_ULTIMO_ADMIN });
    expect(usuarioDeleteMock).not.toHaveBeenCalled();
  });

  it("permite a exclusão de um ADMIN quando existem dois ou mais ADMIN ativos", async () => {
    const adminAtor = registroAdmin({ id: 1 });
    const adminAlvo = registroAdmin({ id: 3, nome: "Outro Admin", email: "outro@empresa.com" });
    configurarBanco([adminAtor, adminAlvo]);
    usuarioCountMock.mockResolvedValue(2); // dois ADMIN ativos
    usuarioDeleteMock.mockResolvedValue(adminAlvo);
    cookieAtual = criarTokenSessao(adminAtor.id);

    await expect(deleteUsuario(formDataComId(adminAlvo.id))).rejects.toThrow("NEXT_REDIRECT:/usuarios");
    expect(usuarioDeleteMock).toHaveBeenCalledWith({ where: { id: adminAlvo.id } });
  });

  it("não bloqueia a exclusão de um usuário TECNICO mesmo com um único ADMIN ativo no sistema", async () => {
    const admin = registroAdmin();
    const tecnico = registroTecnico();
    configurarBanco([admin, tecnico]);
    usuarioCountMock.mockResolvedValue(1);
    usuarioDeleteMock.mockResolvedValue(tecnico);
    cookieAtual = criarTokenSessao(admin.id);

    await expect(deleteUsuario(formDataComId(tecnico.id))).rejects.toThrow("NEXT_REDIRECT:/usuarios");
    expect(usuarioDeleteMock).toHaveBeenCalled();
  });

  it("TECNICO chamando deleteUsuario diretamente é bloqueado (camada 3, independente da UI)", async () => {
    const tecnico = registroTecnico();
    configurarBanco([tecnico]);
    cookieAtual = criarTokenSessao(tecnico.id);

    await expect(deleteUsuario(formDataComId(1))).rejects.toBeInstanceOf(ErroSemPermissao);
    expect(usuarioDeleteMock).not.toHaveBeenCalled();
  });
});

describe("Proteção do último ADMIN ativo — desativação (toggleUsuarioAtivo)", () => {
  it("bloqueia a desativação quando o alvo é o único ADMIN ativo do sistema", async () => {
    const admin = registroAdmin();
    configurarBanco([admin]);
    usuarioCountMock.mockResolvedValue(1);
    cookieAtual = criarTokenSessao(admin.id);

    const resultado = await toggleUsuarioAtivo(formDataComId(admin.id));

    expect(resultado).toEqual({ ok: false, erro: MSG_ULTIMO_ADMIN });
    expect(usuarioUpdateMock).not.toHaveBeenCalled();
  });

  it("permite desativar um ADMIN quando existem dois ou mais ADMIN ativos — mesmo sendo a própria conta do ator", async () => {
    // Prova de que a regra não depende de identidade (autor vs. alvo): com
    // 2+ admins ativos, mesmo o próprio ator pode se desativar sem quebrar
    // o sistema — a regra antiga bloqueava TODA autodesativação, sem
    // olhar a contagem; a regra corrigida olha só o resultado final.
    const admin = registroAdmin();
    configurarBanco([admin]);
    usuarioCountMock.mockResolvedValue(2);
    usuarioUpdateMock.mockResolvedValue({ ...admin, ativo: false });
    cookieAtual = criarTokenSessao(admin.id);

    const resultado = await toggleUsuarioAtivo(formDataComId(admin.id));

    expect(resultado).toEqual({ ok: true });
    expect(usuarioUpdateMock).toHaveBeenCalledWith({ where: { id: admin.id }, data: { ativo: false } });
  });

  it("ativar um usuário (que está inativo) nunca é bloqueado, independente da contagem de admins", async () => {
    const admin = registroAdmin({ ativo: false });
    configurarBanco([admin]);
    usuarioCountMock.mockResolvedValue(0);
    usuarioUpdateMock.mockResolvedValue({ ...admin, ativo: true });
    // Ator precisa ser um ADMIN ativo para passar por requireAdminAction —
    // usamos um segundo admin ativo só para autenticar a chamada.
    const atorAtivo = registroAdmin({ id: 9 });
    configurarBanco([admin, atorAtivo]);
    cookieAtual = criarTokenSessao(atorAtivo.id);

    const resultado = await toggleUsuarioAtivo(formDataComId(admin.id));
    expect(resultado).toEqual({ ok: true });
  });
});

describe("Proteção do último ADMIN ativo — troca de perfil (updateUsuario)", () => {
  const dadosFormularioBase = {
    nome: "Ana Admin",
    email: "ana@empresa.com",
    senha: "",
  };

  function formDataAtualizacao(id: number, perfil: "ADMIN" | "TECNICO") {
    const fd = new FormData();
    fd.append("id", String(id));
    fd.append("nome", dadosFormularioBase.nome);
    fd.append("email", dadosFormularioBase.email);
    fd.append("senha", dadosFormularioBase.senha);
    fd.append("perfil", perfil);
    return fd;
  }

  it("bloqueia a troca de perfil para TECNICO quando o alvo é o único ADMIN ativo", async () => {
    const admin = registroAdmin();
    configurarBanco([admin]);
    usuarioCountMock.mockResolvedValue(1);
    cookieAtual = criarTokenSessao(admin.id);

    const resultado = await updateUsuario(formDataAtualizacao(admin.id, "TECNICO"));

    expect(resultado).toEqual({ ok: false, erro: MSG_ULTIMO_ADMIN });
    expect(usuarioUpdateMock).not.toHaveBeenCalled();
  });

  it("permite trocar o perfil de um ADMIN para TECNICO quando existem dois ou mais ADMIN ativos", async () => {
    const adminAtor = registroAdmin({ id: 1 });
    const adminAlvo = registroAdmin({ id: 5, nome: "Outro Admin", email: "outro@empresa.com" });
    configurarBanco([adminAtor, adminAlvo]);
    usuarioCountMock.mockResolvedValue(2);
    usuarioUpdateMock.mockResolvedValue({ ...adminAlvo, perfil: "TECNICO" });
    cookieAtual = criarTokenSessao(adminAtor.id);

    await expect(updateUsuario(formDataAtualizacao(adminAlvo.id, "TECNICO"))).rejects.toThrow(
      "NEXT_REDIRECT:/usuarios"
    );
    expect(usuarioUpdateMock).toHaveBeenCalled();
  });

  it("manter o perfil como ADMIN nunca é bloqueado pela proteção do último admin (não há redução de contagem)", async () => {
    const admin = registroAdmin();
    configurarBanco([admin]);
    usuarioCountMock.mockResolvedValue(1);
    usuarioUpdateMock.mockResolvedValue(admin);
    cookieAtual = criarTokenSessao(admin.id);

    await expect(updateUsuario(formDataAtualizacao(admin.id, "ADMIN"))).rejects.toThrow("NEXT_REDIRECT:/usuarios");
    // Perfil continua ADMIN — operacaoDeixariaSemAdminAtivo nem deveria
    // rodar a contagem, então usuarioCountMock não precisa ser chamado.
    expect(usuarioUpdateMock).toHaveBeenCalled();
  });
});
