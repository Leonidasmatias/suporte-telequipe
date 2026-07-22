"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { sair } from "@/app/login/actions";
import { canAccess, RECURSOS } from "@/lib/permissoes";
import { navItems } from "@/lib/navegacao";
import type { UsuarioSessao } from "@/lib/auth";

const ROTULO_PERFIL: Record<UsuarioSessao["perfil"], string> = {
  ADMIN: "Administrador",
  TECNICO: "Técnico",
};

/**
 * Cabeçalho corporativo fixo no topo da área de conteúdo (missão "TELEQUIPE
 * SUPORTE STA v7.0" — sprint exclusivamente visual). Não busca nenhum dado
 * novo: usa o mesmo `usuario` de sessão já repassado para a Sidebar, e
 * deriva título/breadcrumb apenas a partir da própria URL atual (nenhuma
 * consulta, nenhuma nova Server Action). Notificações e o atalho de
 * configurações são elementos de interface — nada aqui altera regra de
 * negócio ou permissões (o atalho de configurações só aparece quando o
 * próprio usuário já tem acesso à rota real de destino).
 */
export default function Header({ usuario }: { usuario: UsuarioSessao }) {
  const pathname = usePathname() || "/";
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [pending, startTransition] = useTransition();

  const segmentos = pathname.split("/").filter(Boolean);
  const itemAtual = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const titulo = itemAtual?.label ?? "TELEQUIPE SUPORTE STA";
  const podeConfigurar = canAccess(usuario, RECURSOS.usuarios);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-graphite-800 bg-[#ffffff]/90 px-6 backdrop-blur">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-graphite-500">
          <span>TELEQUIPE SUPORTE STA</span>
          {segmentos.length > 0 && (
            <>
              <span aria-hidden>/</span>
              <span className="truncate text-neon-500">{titulo}</span>
            </>
          )}
        </nav>
        <h1 className="truncate text-lg font-semibold text-graphite-100">{titulo}</h1>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {/* Notificações — elemento de interface estático (sem fonte de dados própria) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificacoesAbertas((v) => !v)}
            className="btn-ghost h-9 w-9 rounded-full p-0"
            aria-label="Notificações"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {notificacoesAbertas && (
            <div className="absolute right-0 top-11 w-64 animate-fade-in rounded-lg border border-graphite-800 bg-[#ffffff] p-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-graphite-400">Notificações</p>
              <p className="mt-2 text-sm text-graphite-400">Nenhuma notificação no momento.</p>
            </div>
          )}
        </div>

        {/* Configurações — só é exibido/clicável para quem já tem acesso à própria rota de destino */}
        {podeConfigurar && (
          <Link href="/usuarios" className="btn-ghost h-9 w-9 rounded-full p-0" aria-label="Configurações">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        )}

        {/* Perfil do usuário */}
        <div className="ml-1 flex items-center gap-2.5 border-l border-graphite-800 pl-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neon-50 text-sm font-semibold text-neon-600">
            {usuario.nome.charAt(0).toUpperCase()}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="truncate text-sm font-medium text-graphite-100">{usuario.nome}</p>
            <p className="text-[11px] text-graphite-500">{ROTULO_PERFIL[usuario.perfil]}</p>
          </div>
          <button
            type="button"
            onClick={() => startTransition(() => sair())}
            disabled={pending}
            className="btn-ghost ml-1 hidden text-xs md:inline-flex"
          >
            {pending && <span className="spinner" aria-hidden />}
            {pending ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>
    </header>
  );
}
