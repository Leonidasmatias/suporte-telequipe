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
    <div className="flex min-h-screen items-center justify-center bg-[#ffffff] px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-500 text-2xl font-bold text-[#ffffff] shadow-glow">
            T
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-graphite-100">Sistema de Suporte STA</h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-neon-500">
              TELEQUIPE Projetos e Telecomunicações
            </p>
          </div>
        </div>
        <div className="card border-graphite-800 shadow-panel">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-[11px] text-graphite-500">
          © {new Date().getFullYear()} Telequipe Projetos e Telecomunicações
        </p>
      </div>
    </div>
  );
}
