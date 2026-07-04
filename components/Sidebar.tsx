"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { href: "/home", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/lideres", label: "Líderes", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" },
  { href: "/equipes", label: "Equipes", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" },
  { href: "/colaboradores", label: "Colaboradores", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { href: "/matriz-nokia", label: "Matriz Nokia", icon: "M9 3v18M15 3v18M3 9h18M3 15h18" },
  { href: "/treinamentos", label: "Treinamentos", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0v7m-9-5v3a9 3 0 0018 0v-3" },
  { href: "/insights-operacionais", label: "Insights Operacionais", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          ST
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">SUPORTE</p>
          <p className="text-xs font-medium tracking-wide text-brand-600">TELEQUIPE</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Em breve
          </p>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300">
            Indicadores
          </div>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300">
            Relatórios
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-400">v2.0 · Inteligência Operacional</p>
      </div>
    </aside>
  );
}
