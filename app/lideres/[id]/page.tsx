import { redirect } from "next/navigation";

/** ROTA DESATIVADA (V6) — ver comentário em app/lideres/page.tsx. */
export default function LiderDetalhePageDesativada() {
  redirect("/colaboradores");
}
