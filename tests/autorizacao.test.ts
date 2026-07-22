import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Etapa 3 — Permissões. Cobre os cenários obrigatórios da especificação:
 *   - Autenticação: usuário não autenticado é bloqueado; autenticado é
 *     liberado; usuário desativado perde acesso mesmo com cookie válido.
 *   - ADMIN: acessa Usuários/Configurações administrativas, executa ações
 *     restritas, vê os menus de admin (canAccess/canPerform).
 *   - TECNICO: não acessa por URL direta módulos admin-only, não consegue
 *     chamar Server Action admin-only nem API admin-only, não vê os
 *     recursos restritos no menu, mantém os módulos operacionais.
 *   - HTTP/segurança: 401 sem sessão, 403 sem permissão, payload
 *     manipulado (perfil "ADMIN" forjado direto no FormData) não contorna
 *     a checagem porque o perfil nunca vem do cliente — sempre do banco.
 *   - Mudança de perfil/inativação é respeitada na próxima checagem (o
 *     cookie de sessão nunca carrega perfil/ativo — só o id do usuário).
 *
 * Estratégia de mock (mesmo padrão de tests/exportarAtendimentos.test.ts):
 * `lib/prisma` é substituído por um stub controlável por teste, evitando
 * conexão real com banco. `next/headers` e `next/navigation` também são
 * mockados porque só existem em runtime de requisição do Next — fora dele
 * (como aqui, no Vitest) `cookies()`/`redirect()` reais lançariam erro. O
 * mock de `redirect()` replica o comportamento real (lança em vez de
 * retornar), para que os testes consigam distinguir "redirecionou para X"
 * de "continuou executando".
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

const { hashSenha, verificarSenha, senhaAtendeRequisitosMinimos } = await import("@/lib/senha");
const { criarTokenSessao, getUsuarioAtual } = await import("@/lib/auth");
const {
  RECURSOS,
  ACOES,
  canAccess,
  canPerform,
  requireAuthenticatedUser,
  requireAdmin,
  requireAccess,
  requireAuthenticatedAction,
  requireAdminAction,
  requirePerformAction,
  verificarAcessoApi,
  ErroNaoAutenticado,
  ErroSemPermissao,
} = await import("@/lib/autorizacao");

function usuarioAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 1, nome: "Ana Admin", email: "ana@empresa.com", perfil: "ADMIN", ativo: true, ...overrides };
}
function usuarioTecnico(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 2, nome: "Tiago Técnico", email: "tiago@empresa.com", perfil: "TECNICO", ativo: true, ...overrides };
}

beforeEach(() => {
  cookieAtual = undefined;
  usuarioFindUniqueMock.mockReset();
  redirectMock.mockClear();
});

// ---------------------------------------------------------------------------
// lib/senha.ts — hash/verificação de senha
// ---------------------------------------------------------------------------

describe("lib/senha — hash e verificação", () => {
  it("hashSenha produz um valor diferente da senha original, no formato salt:hash", () => {
    const hash = hashSenha("MinhaSenh@123");
    expect(hash).not.toBe("MinhaSenh@123");
    expect(hash.split(":")).toHaveLength(2);
  });

  it("verificarSenha aceita a senha correta", () => {
    const hash = hashSenha("MinhaSenh@123");
    expect(verificarSenha("MinhaSenh@123", hash)).toBe(true);
  });

  it("verificarSenha rejeita senha incorreta", () => {
    const hash = hashSenha("MinhaSenh@123");
    expect(verificarSenha("outra-senha", hash)).toBe(false);
  });

  it("verificarSenha rejeita hash malformado sem lançar exceção", () => {
    expect(verificarSenha("qualquer", "formato-invalido-sem-separador")).toBe(false);
  });

  it("senhaAtendeRequisitosMinimos exige ao menos 8 caracteres", () => {
    expect(senhaAtendeRequisitosMinimos("1234567")).toBe(false);
    expect(senhaAtendeRequisitosMinimos("12345678")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// lib/autorizacao.ts — matrizes canAccess/canPerform (leitura pura)
// ---------------------------------------------------------------------------

describe("canAccess — matriz de recursos por perfil", () => {
  it("ADMIN acessa Usuários (gestão de usuários é exclusiva de admin)", () => {
    expect(canAccess(usuarioAdmin() as any, RECURSOS.usuarios)).toBe(true);
  });

  it("TECNICO NÃO acessa Usuários", () => {
    expect(canAccess(usuarioTecnico() as any, RECURSOS.usuarios)).toBe(false);
  });

  it("TECNICO NÃO acessa Importação Massiva (operação administrativa sensível)", () => {
    expect(canAccess(usuarioTecnico() as any, RECURSOS.importacao)).toBe(false);
  });

  it("TECNICO NÃO acessa Insights Operacionais (proibido explicitamente pela especificação)", () => {
    expect(canAccess(usuarioTecnico() as any, RECURSOS.insightsOperacionais)).toBe(false);
  });

  it("TECNICO NÃO acessa Colaboradores (não está na lista fechada de módulos liberados ao TECNICO)", () => {
    expect(canAccess(usuarioTecnico() as any, RECURSOS.colaboradores)).toBe(false);
  });

  it("TECNICO acessa os módulos operacionais liberados (Dashboard/Home, Suporte, Matriz Nokia, Treinamentos, Relatórios de Suporte)", () => {
    const tecnico = usuarioTecnico() as any;
    expect(canAccess(tecnico, RECURSOS.dashboard)).toBe(true);
    expect(canAccess(tecnico, RECURSOS.atendimentos)).toBe(true);
    expect(canAccess(tecnico, RECURSOS.matrizNokia)).toBe(true);
    expect(canAccess(tecnico, RECURSOS.treinamentos)).toBe(true);
    expect(canAccess(tecnico, RECURSOS.relatorios)).toBe(true);
    expect(canAccess(tecnico, RECURSOS.exportacoes)).toBe(true);
  });

  it("ADMIN acessa todos os módulos administrativos (Colaboradores, Insights, Importação, Usuários)", () => {
    const admin = usuarioAdmin() as any;
    expect(canAccess(admin, RECURSOS.colaboradores)).toBe(true);
    expect(canAccess(admin, RECURSOS.insightsOperacionais)).toBe(true);
    expect(canAccess(admin, RECURSOS.importacao)).toBe(true);
    expect(canAccess(admin, RECURSOS.usuarios)).toBe(true);
  });

  it("usuário nulo (não autenticado) não acessa nenhum recurso", () => {
    expect(canAccess(null, RECURSOS.dashboard)).toBe(false);
    expect(canAccess(null, RECURSOS.usuarios)).toBe(false);
  });
});

describe("canPerform — matriz de ações por perfil", () => {
  it("TECNICO pode criar, editar e encerrar atendimentos, mas não excluir", () => {
    const tecnico = usuarioTecnico() as any;
    expect(canPerform(tecnico, ACOES["atendimentos.criar"])).toBe(true);
    expect(canPerform(tecnico, ACOES["atendimentos.editar"])).toBe(true);
    expect(canPerform(tecnico, ACOES["atendimentos.encerrar"])).toBe(true);
    expect(canPerform(tecnico, ACOES["atendimentos.excluir"])).toBe(false);
  });

  it("ADMIN pode excluir atendimentos e escrever em Usuários", () => {
    const admin = usuarioAdmin() as any;
    expect(canPerform(admin, ACOES["atendimentos.excluir"])).toBe(true);
    expect(canPerform(admin, ACOES["usuarios.escrever"])).toBe(true);
  });

  it("TECNICO não pode escrever em Colaboradores, Matriz Nokia, Treinamentos ou Usuários", () => {
    const tecnico = usuarioTecnico() as any;
    expect(canPerform(tecnico, ACOES["colaboradores.escrever"])).toBe(false);
    expect(canPerform(tecnico, ACOES["matrizNokia.escrever"])).toBe(false);
    expect(canPerform(tecnico, ACOES["treinamentos.escrever"])).toBe(false);
    expect(canPerform(tecnico, ACOES["usuarios.escrever"])).toBe(false);
  });

  it("usuário nulo não pode executar nenhuma ação", () => {
    expect(canPerform(null, ACOES["atendimentos.criar"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Guards de página (Server Components) — usam redirect()
// ---------------------------------------------------------------------------

describe("requireAuthenticatedUser — proteção de página (não autenticado)", () => {
  it("sem cookie de sessão, redireciona para /login", async () => {
    cookieAtual = undefined;
    await expect(requireAuthenticatedUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("com sessão válida, retorna o usuário sem redirecionar", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(usuarioAdmin());
    const usuario = await requireAuthenticatedUser();
    expect(usuario.id).toBe(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("requireAdmin — proteção de página admin-only", () => {
  it("TECNICO autenticado é redirecionado para /acesso-negado (não para /login)", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/acesso-negado");
  });

  it("ADMIN autenticado acessa normalmente", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(usuarioAdmin());
    const usuario = await requireAdmin();
    expect(usuario.perfil).toBe("ADMIN");
  });

  it("não autenticado é redirecionado para /login (não para /acesso-negado)", async () => {
    cookieAtual = undefined;
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("requireAccess — proteção de página por recurso", () => {
  it("TECNICO tentando acessar /usuarios diretamente pela URL é bloqueado (vai para /acesso-negado)", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    await expect(requireAccess(RECURSOS.usuarios)).rejects.toThrow("NEXT_REDIRECT:/acesso-negado");
  });

  it("TECNICO tentando acessar /insights-operacionais diretamente pela URL é bloqueado", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    await expect(requireAccess(RECURSOS.insightsOperacionais)).rejects.toThrow("NEXT_REDIRECT:/acesso-negado");
  });

  it("TECNICO tentando acessar /colaboradores diretamente pela URL é bloqueado", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    await expect(requireAccess(RECURSOS.colaboradores)).rejects.toThrow("NEXT_REDIRECT:/acesso-negado");
  });

  it("TECNICO acessa /suporte (recurso liberado para o perfil dele)", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    const usuario = await requireAccess(RECURSOS.atendimentos);
    expect(usuario.perfil).toBe("TECNICO");
  });

  it("ADMIN acessa /usuarios, /insights-operacionais e /colaboradores normalmente", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(usuarioAdmin());
    await expect(requireAccess(RECURSOS.usuarios)).resolves.toMatchObject({ perfil: "ADMIN" });
    await expect(requireAccess(RECURSOS.insightsOperacionais)).resolves.toMatchObject({ perfil: "ADMIN" });
    await expect(requireAccess(RECURSOS.colaboradores)).resolves.toMatchObject({ perfil: "ADMIN" });
  });
});

// ---------------------------------------------------------------------------
// Guards de Server Action — lançam erro (nunca redirect), 3ª camada de defesa
// ---------------------------------------------------------------------------

describe("requireAuthenticatedAction — Server Action chamada sem sessão", () => {
  it("lança ErroNaoAutenticado quando não há sessão (ex.: chamada direta via fetch/curl sem cookie)", async () => {
    cookieAtual = undefined;
    await expect(requireAuthenticatedAction()).rejects.toBeInstanceOf(ErroNaoAutenticado);
  });
});

describe("requireAdminAction — Server Action admin-only chamada por TECNICO", () => {
  it("TECNICO chamando diretamente uma Server Action admin-only (ex.: excluir usuário) recebe ErroSemPermissao, mesmo manipulando o formulário", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    await expect(requireAdminAction()).rejects.toBeInstanceOf(ErroSemPermissao);
  });

  it("payload manipulado não contorna a checagem: mesmo que o cliente envie perfil=ADMIN em algum campo, a checagem usa sempre o perfil do banco (o mock de findUnique aqui devolve TECNICO independente do que seria 'enviado')", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    // Simula um FormData forjado tentando alegar perfil administrativo — a
    // função de autorização nunca lê esse campo; ela só confia no usuário
    // resolvido a partir do cookie assinado + banco de dados.
    const formDataForjado = new FormData();
    formDataForjado.set("perfil", "ADMIN");
    await expect(requireAdminAction()).rejects.toBeInstanceOf(ErroSemPermissao);
  });

  it("ADMIN chamando a mesma Server Action é autorizado", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(usuarioAdmin());
    const usuario = await requireAdminAction();
    expect(usuario.perfil).toBe("ADMIN");
  });
});

describe("requirePerformAction — checagem granular por ação", () => {
  it("TECNICO chamando a Server Action de excluir atendimento (admin-only) é bloqueado", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    await expect(requirePerformAction(ACOES["atendimentos.excluir"])).rejects.toBeInstanceOf(ErroSemPermissao);
  });

  it("TECNICO chamando a Server Action de criar atendimento (liberada) é autorizado", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    const usuario = await requirePerformAction(ACOES["atendimentos.criar"]);
    expect(usuario.id).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Rota de API (verificarAcessoApi) — 401/403 padronizados
// ---------------------------------------------------------------------------

describe("verificarAcessoApi — respostas HTTP padronizadas", () => {
  it("retorna ok:false com 401 quando não há sessão (chamada direta à API sem cookie)", async () => {
    cookieAtual = undefined;
    const resultado = await verificarAcessoApi(RECURSOS.exportacoes);
    expect(resultado).toEqual({
      ok: false,
      status: 401,
      body: { ok: false, error: "Não autenticado." },
    });
  });

  it("retorna ok:false com 403 quando autenticado mas sem permissão para o recurso", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    const resultado = await verificarAcessoApi(RECURSOS.usuarios);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.status).toBe(403);
      expect(resultado.body.ok).toBe(false);
    }
  });

  it("retorna ok:true com o usuário quando autenticado e autorizado (a rota de exportação precisa do usuário para calcular o escopo)", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico());
    const resultado = await verificarAcessoApi(RECURSOS.exportacoes);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.usuario.id).toBe(2);
      expect(resultado.usuario.perfil).toBe("TECNICO");
    }
  });

  it("mensagens de erro não vazam detalhe interno (caminho de arquivo, stack trace, quebras de linha)", async () => {
    cookieAtual = undefined;
    const resultado = await verificarAcessoApi(RECURSOS.usuarios);
    const mensagem = !resultado.ok ? resultado.body.error : "";
    expect(mensagem).not.toMatch(/lib\/|\.ts:|node_modules|\bat \w|\n/);
  });
});

// ---------------------------------------------------------------------------
// lib/auth.ts — ciclo de vida da sessão (cookie nunca carrega perfil/ativo)
// ---------------------------------------------------------------------------

describe("getUsuarioAtual — sessão sempre revalidada contra o banco", () => {
  it("sem cookie, retorna null", async () => {
    cookieAtual = undefined;
    expect(await getUsuarioAtual()).toBeNull();
  });

  it("cookie com assinatura adulterada (payload manipulado) é rejeitado", async () => {
    const tokenValido = criarTokenSessao(1);
    const partes = tokenValido.split(".");
    // Troca o id do usuário no payload mas mantém a assinatura antiga —
    // simula alguém tentando forjar o cookie para assumir outra conta.
    const tokenAdulterado = `999.${partes[1]}.${partes[2]}`;
    cookieAtual = tokenAdulterado;
    expect(await getUsuarioAtual()).toBeNull();
    expect(usuarioFindUniqueMock).not.toHaveBeenCalled();
  });

  it("cookie expirado é rejeitado mesmo com assinatura válida", async () => {
    // Constrói um token já expirado manualmente (mesmo formato de criarTokenSessao).
    const crypto = await import("crypto");
    const payload = `1.${Date.now() - 1000}`;
    const assinatura = crypto
      .createHmac("sha256", process.env.AUTH_SECRET!)
      .update(payload)
      .digest("hex");
    cookieAtual = `${payload}.${assinatura}`;
    expect(await getUsuarioAtual()).toBeNull();
  });

  it("usuário existente e ativo: sessão retorna os dados atuais do banco", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(usuarioAdmin({ nome: "Nome Atualizado" }));
    const usuario = await getUsuarioAtual();
    expect(usuario?.nome).toBe("Nome Atualizado");
  });

  it("usuário desativado no banco perde acesso imediatamente, mesmo com cookie ainda válido", async () => {
    cookieAtual = criarTokenSessao(2);
    usuarioFindUniqueMock.mockResolvedValue(usuarioTecnico({ ativo: false }));
    expect(await getUsuarioAtual()).toBeNull();
  });

  it("usuário excluído do banco (findUnique retorna null) perde acesso mesmo com cookie válido", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(null);
    expect(await getUsuarioAtual()).toBeNull();
  });

  it("mudança de perfil no banco (ADMIN rebaixado a TECNICO) é refletida na próxima checagem, sem depender do cookie antigo", async () => {
    cookieAtual = criarTokenSessao(1);
    usuarioFindUniqueMock.mockResolvedValue(usuarioAdmin({ perfil: "TECNICO" }));
    const usuario = await getUsuarioAtual();
    expect(usuario?.perfil).toBe("TECNICO");
  });
});
