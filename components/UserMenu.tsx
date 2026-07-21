"use client";

import { useTransition } from "react";
import { sair } from "@/app/login/actions";
import type { UsuarioSessao } from "@/lib/auth";

const ROTULO_PERFIL: Record<UsuarioSessao["perfil"], string> = {
  ADMIN: "Administrador",
  TECNICO: "Técnico",
};

/** Substitui o antigo EditModeControl: mostra quem está logado e permite sair. Sem senha nenhuma aqui — login é em /login. */
export default function UserMenu({ usuario }: { usuario: UsuarioSessao }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 border-t border-graphite-800 pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-graphite-200">{usuario.nome}</p>
          <p className="text-[10px] uppercase tracking-wide text-neon-400">{ROTULO_PERFIL[usuario.perfil]}</p>
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => sair())}
          disabled={pending}
          className="flex-shrink-0 text-[11px] font-medium text-graphite-500 hover:text-graphite-200"
        >
          {pending ? "Saindo..." : "Sair"}
        </button>
      </div>
    </div>
  );
}
