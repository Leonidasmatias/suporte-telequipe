import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * Única página pública do sistema. Se já existe uma sessão válida, manda
 * direto para /home (evita mostrar a tela de login pra quem já está
 * logado, e evita loop: esta é a ÚNICA página que faz esse redirect "para a
 * frente" — todas as outras fazem redirect "para trás", para /login).
 */
export default async function LoginPage() {
  const usuario = await getUsuarioAtual();
  if (usuario) redirect("/home");

  return (
    <div className="flex min-h-screen items-center justify-center bg-graphite-950 px-4">
      <div className="w-full max-w-sm card">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-neon-500 text-sm font-bold text-graphite-950 shadow-glow">
            LT
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">TELEQUIPE SUPORTE - STA</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neon-400">
              Operator Command Center
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
