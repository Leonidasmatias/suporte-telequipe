"use client";

import { useState, useTransition } from "react";
import { entrar } from "./actions";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData();
    fd.append("email", email);
    fd.append("senha", senha);
    startTransition(async () => {
      // `entrar` chama redirect() no sucesso (o que lança internamente no
      // Next.js) — só chega a retornar um valor de fato no caminho de erro.
      const resultado = await entrar(fd);
      if (resultado && !resultado.ok) {
        setErro(resultado.erro);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label-field">E-mail</label>
        <input
          type="email"
          autoFocus
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="voce@leonidastech.com.br"
        />
      </div>
      <div>
        <label className="label-field">Senha</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="input-field"
          placeholder="••••••••"
        />
      </div>
      {erro && (
        <p className="animate-fade-in rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erro}
        </p>
      )}
      <button type="submit" disabled={pending || !email || !senha} className="btn-primary w-full">
        {pending && <span className="spinner" aria-hidden />}
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
