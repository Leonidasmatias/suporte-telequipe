import { describe, it, expect } from "vitest";
import { navItems } from "@/lib/navegacao";
import { canAccess, RECURSOS } from "@/lib/permissoes";
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
        "Colaboradores",
        "Matriz Nokia",
        "Treinamentos",
        "Insights Operacionais",
        "Suporte Técnico",
        "Relatórios de Suporte",
        "Dashboard Executivo",
        "Importação Massiva",
        "Usuários",
      ])
    );
    expect(labels).toHaveLength(navItems.length);
  });
});

describe("Menu lateral — TECNICO", () => {
  it("vê somente os módulos autorizados pela especificação (Suporte, Treinamentos, Matriz Nokia, Relatórios de Suporte, Dashboard Executivo)", () => {
    const labels = labelsVisiveis(tecnico);
    expect(labels.sort()).toEqual(
      ["Dashboard Executivo", "Matriz Nokia", "Relatórios de Suporte", "Suporte Técnico", "Treinamentos"].sort()
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

describe("Menu lateral — item 'Dashboard Executivo' usa RECURSOS.dashboardExecutivo (Sprint v7.2 — ÚLTIMA REVISÃO)", () => {
  it("o item do menu aponta para /suporte/dashboard e usa o recurso próprio, não RECURSOS.relatorios", () => {
    const item = navItems.find((i) => i.label === "Dashboard Executivo");
    expect(item).toBeDefined();
    expect(item?.href).toBe("/suporte/dashboard");
    expect(item?.recurso).toBe(RECURSOS.dashboardExecutivo);
    expect(item?.recurso).not.toBe(RECURSOS.relatorios);
  });
});

describe("Menu lateral — Ajuste final de navegação (Sprint v7.2)", () => {
  it("o item antigo 'Dashboard' (/home) não aparece mais em navItems", () => {
    expect(navItems.find((i) => i.label === "Dashboard")).toBeUndefined();
    expect(navItems.find((i) => i.href === "/home")).toBeUndefined();
  });

  it("'Dashboard Executivo' é o primeiro item principal do menu", () => {
    expect(navItems[0]?.label).toBe("Dashboard Executivo");
    expect(navItems[0]?.href).toBe("/suporte/dashboard");
  });

  it("ADMIN visualiza 'Dashboard Executivo'", () => {
    expect(labelsVisiveis(admin)).toContain("Dashboard Executivo");
  });

  it("TECNICO visualiza 'Dashboard Executivo'", () => {
    expect(labelsVisiveis(tecnico)).toContain("Dashboard Executivo");
  });

  it("nenhuma outra entrada do menu foi removida (só 'Dashboard' saiu; os outros 8 itens continuam presentes)", () => {
    const labels = navItems.map((i) => i.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Dashboard Executivo",
        "Suporte Técnico",
        "Relatórios de Suporte",
        "Colaboradores",
        "Treinamentos",
        "Matriz Nokia",
        "Insights Operacionais",
        "Importação Massiva",
        "Usuários",
      ])
    );
    expect(navItems).toHaveLength(9);
  });

  it("RECURSOS.dashboard (que protegia o item antigo) continua definido — não foi removido, só deixou de aparecer no menu", () => {
    expect(RECURSOS.dashboard).toBeDefined();
  });
});
