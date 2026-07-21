import { RECURSOS, type Recurso } from "@/lib/permissoes";

/**
 * Itens do menu lateral (componentes/Sidebar.tsx). Extraído para um módulo
 * próprio, sem nenhuma dependência de "next/link"/"next/navigation" ou de
 * "use client", para que os testes de interface (tests/menu.test.ts)
 * importem exatamente os mesmos dados que o Sidebar usa para renderizar —
 * sem precisar de um DOM/jsdom (que este projeto não usa) só para
 * verificar quais itens aparecem para cada perfil.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  recurso: Recurso;
};

export const navItems: NavItem[] = [
  { href: "/home", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", recurso: RECURSOS.dashboard },
  { href: "/colaboradores", label: "Colaboradores", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", recurso: RECURSOS.colaboradores },
  { href: "/matriz-nokia", label: "Matriz Nokia", icon: "M9 3v18M15 3v18M3 9h18M3 15h18", recurso: RECURSOS.matrizNokia },
  { href: "/treinamentos", label: "Treinamentos", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0v7m-9-5v3a9 3 0 0018 0v-3", recurso: RECURSOS.treinamentos },
  { href: "/insights-operacionais", label: "Insights Operacionais", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", recurso: RECURSOS.insightsOperacionais },
  { href: "/suporte", label: "Suporte Técnico", icon: "M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", recurso: RECURSOS.atendimentos },
  { href: "/relatorios/suporte", label: "Relatórios de Suporte", icon: "M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z", recurso: RECURSOS.relatorios },
  { href: "/importacao", label: "Importação Massiva", icon: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12", recurso: RECURSOS.importacao },
  { href: "/usuarios", label: "Usuários", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 10-3-6.65", recurso: RECURSOS.usuarios },
];
