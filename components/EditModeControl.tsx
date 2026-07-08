"use client";

import { useState, useTransition } from "react";
import { desbloquearEdicao, bloquearEdicao } from "@/app/auth/actions";

export default function EditModeControl({ podeEditar }: { podeEditar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDesbloquear(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData();
    fd.append("senha", senha);
    startTransition(async () => {
      const resultado = await desbloquearEdicao(fd);
      if (resultado.ok) {
        setSenha("");
        setAberto(false);
      } else {
        setErro(resultado.erro);
      }
    });
  }

  function handleBloquear() {
    startTransition(async () => {
      await bloquearEdicao();
    });
  }

  if (podeEditar) {
    return (
      <div className="mt-3 border-t border-graphite-800 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-neon-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4m-9 0h10a1 1 0 011 1v7a1 1 0 01-1 1H7a1 1 0 01-1-1v-7a1 1 0 011-1z" />
            </svg>
            <span className="text-[11px] font-medium text-neon-400">Modo de edição ativo</span>
          </div>
          <button
            type="button"
            onClick={handleBloquear}
            disabled={pending}
            className="text-[11px] font-medium text-graphite-500 hover:text-graphite-200"
          >
            Bloquear
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-graphite-800 pt-3">
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex w-full items-center gap-1.5 text-[11px] font-medium text-graphite-500 hover:text-graphite-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
          </svg>
          Modo visualização · destravar edição
        </button>
      ) : (
        <form onSubmit={handleDesbloquear} className="space-y-2">
          <input
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha de edição"
            className="input-field h-8 text-xs"
          />
          {erro && <p className="text-[11px] text-red-400">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending || !senha} className="btn-primary h-7 flex-1 text-xs">
              {pending ? "Verificando..." : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setSenha("");
                setErro(null);
              }}
              className="btn-secondary h-7 flex-1 text-xs"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
