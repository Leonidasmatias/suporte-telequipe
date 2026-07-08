import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { estaEmModoEdicao } from "@/lib/auth";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const podeEditar = estaEmModoEdicao();

  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <Sidebar podeEditar={podeEditar} />
        <main className="ml-64 min-h-screen animate-fade-in p-6 lg:p-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </body>
    </html>
  );
}
