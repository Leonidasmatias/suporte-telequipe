import { redirect } from "next/navigation";

/**
 * Sprint v7.2 — AJUSTE FINAL DE NAVEGAÇÃO: o Dashboard Executivo passou a
 * ser a principal entrada visual do sistema, substituindo /home neste
 * redirecionamento de "página inicial" — /home continua existindo e
 * protegida exatamente como antes (RECURSOS.dashboard), só deixou de ser o
 * destino automático. Um usuário não autenticado que caia aqui é enviado
 * para /suporte/dashboard, cujo próprio `requireAccess` o redireciona para
 * /login (mesmo comportamento de antes, um passo a mais).
 */
export default function RootPage() {
  redirect("/suporte/dashboard");
}
