"use client";

import { useMemo, useState } from "react";

function calcularMinutos(horaInicio: string, horaFim: string): number | null {
  const partes = /^(\d{1,2}):(\d{2})$/;
  const mInicio = horaInicio.match(partes);
  const mFim = horaFim.match(partes);
  if (!mInicio || !mFim) return null;

  const minutosInicio = Number(mInicio[1]) * 60 + Number(mInicio[2]);
  const minutosFim = Number(mFim[1]) * 60 + Number(mFim[2]);

  let diferenca = minutosFim - minutosInicio;
  if (diferenca < 0) diferenca += 24 * 60;
  return diferenca;
}

/**
 * Campos de Hora início / Hora término com cálculo automático (client-side,
 * apenas para exibição em tempo real) do tempo de atendimento em minutos.
 * O valor definitivo é sempre recalculado no servidor em app/suporte/actions.ts.
 */
export default function TempoAtendimentoInputs({
  horaInicioDefault = "",
  horaFimDefault = "",
}: {
  horaInicioDefault?: string;
  horaFimDefault?: string;
}) {
  const [horaInicio, setHoraInicio] = useState(horaInicioDefault);
  const [horaFim, setHoraFim] = useState(horaFimDefault);

  const minutos = useMemo(() => calcularMinutos(horaInicio, horaFim), [horaInicio, horaFim]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label className="label-field">Hora início</label>
        <input
          name="hora_inicio"
          type="time"
          required
          value={horaInicio}
          onChange={(e) => setHoraInicio(e.target.value)}
          className="input-field"
        />
      </div>
      <div>
        <label className="label-field">Hora término</label>
        <input
          name="hora_fim"
          type="time"
          value={horaFim}
          onChange={(e) => setHoraFim(e.target.value)}
          className="input-field"
        />
      </div>
      <div>
        <label className="label-field">Tempo de atendimento</label>
        <div className="input-field flex items-center bg-graphite-800/80 font-medium tabular-nums text-neon-400">
          {minutos !== null ? `${minutos} min` : "—"}
        </div>
      </div>
    </div>
  );
}
