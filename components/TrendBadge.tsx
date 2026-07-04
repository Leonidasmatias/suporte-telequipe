import type { Tendencia } from "@/lib/imt";
import { rotuloTendencia } from "@/lib/imt";

const estilos: Record<Tendencia, string> = {
  subindo: "bg-emerald-50 text-emerald-700",
  caindo: "bg-red-50 text-red-600",
  estavel: "bg-slate-100 text-slate-600",
  indefinido: "bg-slate-50 text-slate-400",
};

const setas: Record<Tendencia, string> = {
  subindo: "▲",
  caindo: "▼",
  estavel: "▬",
  indefinido: "·",
};

export default function TrendBadge({ tendencia }: { tendencia: Tendencia }) {
  return (
    <span className={`badge gap-1 ${estilos[tendencia]}`}>
      <span aria-hidden>{setas[tendencia]}</span>
      {rotuloTendencia(tendencia)}
    </span>
  );
}
