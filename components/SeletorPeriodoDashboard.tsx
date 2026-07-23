"use client";

import { useState } from "react";
import { PERIODOS_DASHBOARD } from "@/lib/dashboardSuporte";

/**
 * Sprint v7.2 — REVISÃO ("Centro de Controle Operacional").
 *
 * Campo "Período" do painel de Filtros Globais de /suporte/dashboard: um
 * `<select>` com as 6 opções fixas da missão (Hoje / Últimos 7 dias /
 * Últimos 30 dias / Este mês / Personalizado / Todos — ver
 * `PERIODOS_DASHBOARD` em lib/dashboardSuporte.ts, única fonte da lista) e,
 * só quando "Personalizado" está selecionado, dois campos de data adicionais
 * (`data_inicio_personalizada`/`data_fim_personalizada`). Mesmo padrão já
 * usado por `components/SeletorCategoriaSuporte.tsx` (um Client Component
 * controlando a exibição condicional de campos dentro de um `<form>` GET
 * comum, sem nenhuma Server Action de escrita envolvida). Componente NOVO.
 */
export default function SeletorPeriodoDashboard({
  periodoDefault,
  dataInicioDefault = "",
  dataFimDefault = "",
}: {
  periodoDefault: string;
  dataInicioDefault?: string;
  dataFimDefault?: string;
}) {
  const [periodo, setPeriodo] = useState(periodoDefault);
  const personalizado = periodo === "personalizado";

  return (
    <>
      <div>
        <label className="label-field">Período</label>
        <select
          name="periodo"
          className="input-field"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        >
          {PERIODOS_DASHBOARD.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </div>
      {personalizado && (
        <>
          <div>
            <label className="label-field">Período — de</label>
            <input type="date" name="data_inicio_personalizada" defaultValue={dataInicioDefault} className="input-field" />
          </div>
          <div>
            <label className="label-field">Período — até</label>
            <input type="date" name="data_fim_personalizada" defaultValue={dataFimDefault} className="input-field" />
          </div>
        </>
      )}
    </>
  );
}
