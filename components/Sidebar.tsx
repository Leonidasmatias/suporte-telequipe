"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";
import { canAccess } from "@/lib/permissoes";
import { navItems } from "@/lib/navegacao";
import type { UsuarioSessao } from "@/lib/auth";

// Etapa 3: cada item de lib/navegacao.ts carrega o `recurso` correspondente
// na matriz de permissões (lib/permissoes.ts) — o menu só mostra o que o
// perfil logado pode acessar. Isto é só a camada 1 (interface); as páginas
// e o backend se protegem de forma independente mesmo que este filtro seja
// contornado. A lista em si vive em lib/navegacao.ts (sem "use client")
// para que tests/menu.test.ts possa importá-la sem precisar de DOM/jsdom.

export default function Sidebar({ usuario }: { usuario: UsuarioSessao }) {
  const pathname = usePathname();
  const itensVisiveis = navItems.filter((item) => canAccess(usuario, item.recurso));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-neon-500">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#ffffff] text-sm font-bold text-neon-500">
          T
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-wide text-[#ffffff]">TELEQUIPE SUPORTE STA</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neon-200">Projetos e Telecomunicações</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {itensVisiveis.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-[#ffffff] text-neon-600 shadow-sm"
                  : "text-neon-100 hover:bg-white/10 hover:text-[#ffffff]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-neon-600 transition-opacity duration-150 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 flex-shrink-0 transition-colors duration-150 ${
                  active ? "text-neon-600" : "text-neon-200 group-hover:text-[#ffffff]"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neon-200">
            Em breve
          </p>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neon-300">
            Indicadores
          </div>
        </div>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffffff] opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ffffff]" />
          </span>
          <p className="text-xs text-neon-100">Sistema operacional</p>
        </div>
        <p className="mt-1 text-[11px] text-neon-200">v7.0 · Suporte Telequipe</p>

        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neon-200">
            Desenvolvido por
          </p>
          <p className="mt-1 text-xs font-medium text-neon-50">Leônidas Matias</p>
          <a href="tel:+5511937299687" className="mt-0.5 block text-[11px] text-neon-200 hover:text-[#ffffff]">
            (11) 93729-9687
          </a>
          <a
            href="mailto:leonidasmatias81@gmail.com"
            className="block text-[11px] text-neon-200 hover:text-[#ffffff]"
          >
            leonidasmatias81@gmail.com
          </a>
        </div>

        <UserMenu usuario={usuario} />
      </div>
    </aside>
  );
}
