import { redirect } from "next/navigation";

/**
 * ROTA DESATIVADA (V6 — Reestruturação Corporativa do Cadastro de
 * Colaboradores). O conceito de "Equipe" foi eliminado: todo profissional
 * agora é um Colaborador (ver /colaboradores). Este arquivo não pôde ser
 * fisicamente removido nesta sessão (sandbox sem acesso a shell), então foi
 * esvaziado e reduzido a um redirecionamento para não quebrar o build nem
 * deixar referências a modelos de banco que não existem mais.
 */
export default function EquipesPageDesativada() {
  redirect("/colaboradores");
}
