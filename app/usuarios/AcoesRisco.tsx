"use client";

import { useState, useTransition } from "react";
import { toggleUsuarioAtivo, deleteUsuario } from "./actions";

/**
 * Botões de ação "de risco" (ativar/desativar, excluir) para a Gestão de
 * Usuários. Client Components porque precisam mostrar o resultado tratado
 * da Server Action (ex.: "O sistema deve possuir pelo menos um
 * administrador ativo.") em vez de falhar silenciosamente — mesmo padrão já
 * usado em LoginForm.tsx e UsuarioForm.tsx (useTransition + chamada manual
 * da action, sem useFormState porque a versão de react-dom deste projeto
 * não o exporta ainda).
 */

export function ToggleAtivoButton({ id, ativo }: { id: number; ativo: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    setErro(null);
    const fd = new FormData();
    fd.append("id", String(id));
    startTransition(async () => {
      const resultado = await toggleUsuarioAtivo(fd);
      if (!resultado.ok) setErro(resultado.erro);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`badge cursor-pointer transition-opacity hover:opacity-75 disabled:opacity-50 ${
          ativo ? "chip-success" : "chip-neutral"
        }`}
        title={ativo ? "Clique para desativar" : "Clique para ativar"}
      >
        {pending ? "Aguarde..." : ativo ? "Ativo" : "Inativo"}
      </button>
      {erro && <p className="mt-1 text-xs text-red-400">{erro}</p>}
    </div>
  );
}

export function ToggleAtivoAcaoGrande({ id, ativo }: { id: number; ativo: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    setErro(null);
    const fd = new FormData();
    fd.append("id", String(id));
    startTransition(async () => {
      const resultado = await toggleUsuarioAtivo(fd);
      if (!resultado.ok) setErro(resultado.erro);
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={pending} className="btn-secondary">
        {pending ? "Aguarde..." : ativo ? "Desativar" : "Ativar"}
      </button>
      {erro && <p className="mt-1.5 max-w-[220px] text-right text-xs text-red-400">{erro}</p>}
    </div>
  );
}

export function ExcluirUsuarioButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    setErro(null);
    const fd = new FormData();
    fd.append("id", String(id));
    startTransition(async () => {
      // Em caso de sucesso, deleteUsuario chama redirect("/usuarios") — o
      // valor só é lido de fato no caminho de erro (mesmo padrão de
      // createUsuario/updateUsuario em UsuarioForm.tsx).
      const resultado = await deleteUsuario(fd);
      if (resultado && !resultado.ok) setErro(resultado.erro);
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={pending} className="btn-danger">
        {pending ? "Excluindo..." : "Excluir"}
      </button>
      {erro && <p className="mt-1.5 max-w-[220px] text-right text-xs text-red-400">{erro}</p>}
    </div>
  );
}
