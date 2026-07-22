"use client";

import { useState, useTransition } from "react";
import type { SalvarUsuarioResultado } from "./actions";

type Props = {
  action: (formData: FormData) => Promise<SalvarUsuarioResultado>;
  modo: "criar" | "editar";
  valoresIniciais?: {
    id: number;
    nome: string;
    email: string;
    perfil: "ADMIN" | "TECNICO";
  };
  /** Desabilita a troca de perfil (autoproteção: admin editando a própria conta). */
  bloquearTrocaPerfil?: boolean;
};

/** Formulário compartilhado entre /usuarios/novo (criar) e /usuarios/[id] (editar). */
export default function UsuarioForm({ action, modo, valoresIniciais, bloquearTrocaPerfil }: Props) {
  const [nome, setNome] = useState(valoresIniciais?.nome ?? "");
  const [email, setEmail] = useState(valoresIniciais?.email ?? "");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<"ADMIN" | "TECNICO">(valoresIniciais?.perfil ?? "TECNICO");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData();
    if (valoresIniciais) fd.append("id", String(valoresIniciais.id));
    fd.append("nome", nome);
    fd.append("email", email);
    fd.append("senha", senha);
    fd.append("perfil", perfil);
    startTransition(async () => {
      // A action chama redirect() no sucesso — só retorna valor no caminho de erro.
      const resultado = await action(fd);
      if (resultado && !resultado.ok) {
        setErro(resultado.erro);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="label-field">Nome</label>
        <input
          required
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="input-field"
          placeholder="Nome completo"
        />
      </div>
      <div>
        <label className="label-field">E-mail</label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="pessoa@leonidastech.com.br"
        />
      </div>
      <div>
        <label className="label-field">
          {modo === "criar" ? "Senha" : "Nova senha (deixe em branco para manter a atual)"}
        </label>
        <input
          type="password"
          required={modo === "criar"}
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="input-field"
          placeholder={modo === "criar" ? "Mínimo 8 caracteres" : "••••••••"}
        />
      </div>
      <div>
        <label className="label-field">Perfil</label>
        <select
          value={perfil}
          onChange={(e) => setPerfil(e.target.value as "ADMIN" | "TECNICO")}
          className="input-field"
          disabled={bloquearTrocaPerfil}
        >
          <option value="ADMIN">Administrador — acesso completo</option>
          <option value="TECNICO">Técnico — acesso operacional</option>
        </select>
        {bloquearTrocaPerfil && (
          <p className="mt-1.5 text-xs text-graphite-500">
            Você não pode remover o próprio perfil de administrador.
          </p>
        )}
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex justify-end border-t border-graphite-800 pt-4">
        <button type="submit" disabled={pending || !nome || !email} className="btn-primary">
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
