"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import EditModeControl from "./EditModeControl";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { href: "/home", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/colaboradores", label: "Colaboradores", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { href: "/matriz-nokia", label: "Matriz Nokia", icon: "M9 3v18M15 3v18M3 9h18M3 15h18" },
  { href: "/treinamentos", label: "Treinamentos", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0v7m-9-5v3a9 3 0 0018 0v-3" },
  { href: "/insights-operacionais", label: "Insights Operacionais", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { href: "/suporte", label: "Suporte Técnico", icon: "M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
  { href: "/importacao", label: "Importação Massiva", icon: "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" },
];

export default function Sidebar({ podeEditar }: { podeEditar: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-graphite-800 bg-graphite-900/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 border-b border-graphite-800 px-5">
        <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neon-500 text-sm font-bold text-graphite-950 shadow-glow">
          LT
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-wide text-white">LEONIDAS TECH</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neon-400">Operator Command Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-neon-500/10 text-white"
                  : "text-graphite-400 hover:bg-graphite-800 hover:text-graphite-100"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-neon-500 transition-opacity duration-150 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 flex-shrink-0 transition-colors duration-150 ${
                  active ? "text-neon-400" : "text-graphite-500 group-hover:text-graphite-200"
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
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-graphite-600">
            Em breve
          </p>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-graphite-700">
            Indicadores
          </div>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-graphite-700">
            Relatórios
          </div>
        </div>
      </nav>

      <div className="border-t border-graphite-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-500" />
          </span>
          <p className="text-xs text-graphite-400">Sistema operacional</p>
        </div>
        <p className="mt-1 text-[11px] text-graphite-600">v6.0 · Suporte Telequipe</p>

        <div className="mt-3 border-t border-graphite-800 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-graphite-600">
            Desenvolvido por
          </p>
          <p className="mt-1 text-xs font-medium text-graphite-300">Leônidas Matias</p>
          <a href="tel:+5511937299687" className="mt-0.5 block text-[11px] text-graphite-500 hover:text-neon-400">
            (11) 93729-9687
          </a>
          <a
            href="mailto:leonidasmatias81@gmail.com"
            className="block text-[11px] text-graphite-500 hover:text-neon-400"
          >
            leonidasmatias81@gmail.com
          </a>
        </div>

        <EditModeControl podeEditar={podeEditar} />
      </div>
    </aside>
  );
}
