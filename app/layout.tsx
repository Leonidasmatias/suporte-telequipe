import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { getUsuarioAtual } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SUPORTE TELEQUIPE — Leonidas Tech",
  description: "Operator Command Center · Gestão operacional de equipes técnicas de telecom",
};

/**
 * O layout raiz NUNCA redireciona sozinho — quem decide "precisa estar
 * logado"/"precisa ser ADMIN" é cada página, chamando
 * requireAuthenticatedUser()/requireAdmin() (lib/autorizacao.ts) antes de
 * renderizar seu próprio conteúdo. Isso evita loop de redirecionamento: o
 * layout só decide *chrome visual* (mostrar a barra lateral ou não) a partir
 * de já saber se existe usuário logado — nunca força navegação.
 *
 * Sem usuário logado (ex.: em /login, ou entre o cookie expirar e a própria
 * página redirecionar) o layout simplesmente não desenha a Sidebar; a
 * página de login já é centralizada em tela cheia por conta própria.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioAtual();

  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {usuario ? (
          <>
            <Sidebar usuario={usuario} />
            <main className="ml-64 min-h-screen animate-fade-in p-6 lg:p-8">
              <div className="mx-auto max-w-[1600px]">{children}</div>
            </main>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
