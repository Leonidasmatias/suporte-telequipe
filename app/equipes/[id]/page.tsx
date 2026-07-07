import { redirect } from "next/navigation";

/** ROTA DESATIVADA (V6) — ver comentário em app/equipes/page.tsx. */
export default function EquipeDetalhePageDesativada() {
  redirect("/colaboradores");
}
