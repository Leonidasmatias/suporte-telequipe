import type { Tendencia } from "@/lib/imt";
import { rotuloTendencia } from "@/lib/imt";

const estilos: Record<Tendencia, string> = {
  subindo: "chip-success",
  caindo: "chip-danger",
  estavel: "chip-neutral",
  indefinido: "bg-transparent text-graphite-600 border-graphite-800",
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
