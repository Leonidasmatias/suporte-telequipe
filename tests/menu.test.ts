import { describe, it, expect } from "vitest";
import { navItems } from "@/lib/navegacao";
import { canAccess } from "@/lib/permissoes";
import type { UsuarioSessao } from "@/lib/auth";

/**
 * Etapa 3 — Camada 1 (interface). Testa exatamente os dados que
 * components/Sidebar.tsx usa para renderizar o menu (navItems + canAccess),
 * sem precisar de DOM/jsdom (que este projeto não usa) — se o menu
 * renderizado algum dia divergir dessa lista, é porque o próprio Sidebar
 * parou de usar navItems/canAccess, o que já seria coberto por uma leitura
 * de código; o que este teste garante é que a MATRIZ por trás do menu bate
 * com a lista fechada de módulos da especificação para cada perfil.
 */

const admin: UsuarioSessao = { id: 1, nome: "Ana Admin", email: "ana@empresa.com", perfil: "ADMIN" };
const tecnico: UsuarioSessao = { id: 2, nome: "Tiago Técnico", email: "tiago@empresa.com", perfil: "TECNICO" };

function labelsVisiveis(usuario: UsuarioSessao): string[] {
  return navItems.filter((item) => canAccess(usuario, item.recurso)).map((item) => item.label);
}

describe("Menu lateral — ADMIN", () => {
  it("vê todos os módulos administrativos existentes no sistema", () => {
    const labels = labelsVisiveis(admin);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Colaboradores",
        "Matriz Nokia",
        "Treinamentos",
        "Insights Operacionais",
        "Suporte Técnico",
        "Relatórios de Suporte",
        "Importação Massiva",
        "Usuários",
      ])
    );
    expect(labels).toHaveLength(navItems.length);
  });
});

describe("Menu lateral — TECNICO", () => {
  it("vê somente os módulos autorizados pela especificação (Home/Dashboard, Suporte, Treinamentos, Matriz Nokia, Relatórios de Suporte)", () => {
    const labels = labelsVisiveis(tecnico);
    expect(labels.sort()).toEqual(
      ["Dashboard", "Matriz Nokia", "Relatórios de Suporte", "Suporte Técnico", "Treinamentos"].sort()
    );
  });

  it("NÃO vê Usuários, Colaboradores, Importação Massiva ou Insights Operacionais", () => {
    const labels = labelsVisiveis(tecnico);
    expect(labels).not.toContain("Usuários");
    expect(labels).not.toContain("Colaboradores");
    expect(labels).not.toContain("Importação Massiva");
    expect(labels).not.toContain("Insights Operacionais");
  });

  it("não vê nenhum item que o ADMIN vê a mais (é um subconjunto estrito do menu do ADMIN)", () => {
    const doTecnico = new Set(labelsVisiveis(tecnico));
    const doAdmin = new Set(labelsVisiveis(admin));
    for (const label of doTecnico) {
      expect(doAdmin.has(label)).toBe(true);
    }
    expect(doTecnico.size).toBeLessThan(doAdmin.size);
  });
});

describe("Menu lateral — usuário não autenticado", () => {
  it("não vê nenhum item (canAccess nega tudo para usuário nulo)", () => {
    const labels = navItems.filter((item) => canAccess(null, item.recurso));
    expect(labels).toHaveLength(0);
  });
});
