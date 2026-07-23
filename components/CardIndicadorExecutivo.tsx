/**
 * Sprint "v7.2 — Dashboard Executivo de Suporte".
 *
 * Card de indicador com ícone + título + valor + cor, usado só na tela
 * /suporte/dashboard. Componente NOVO — não é uma alteração de
 * `components/StatCard.tsx` (usado em várias outras telas já homologadas,
 * incluindo /suporte e /home): criar um componente novo em vez de estender o
 * existente evita qualquer risco de mudar a aparência de telas que a missão
 * explicitamente pede para não tocar ("NÃO ALTERAR: Design System").
 *
 * As cores usadas abaixo (`neon`/`graphite`/`emerald`/`amber`/`red`) são
 * exatamente os mesmos tokens já definidos em `tailwind.config.ts` e já
 * usados por `StatCard`/`badge`/`chip-*` — nenhuma cor nova foi introduzida.
 */
import Link from "next/link";

type Accent = "brand" | "green" | "amber" | "red" | "slate";

const ACCENT_MAP: Record<Accent, { icone: string; valor: string }> = {
  brand: { icone: "text-neon-500 bg-neon-50", valor: "text-neon-600" },
  green: { icone: "text-emerald-600 bg-emerald-50", valor: "text-emerald-700" },
  amber: { icone: "text-amber-600 bg-amber-50", valor: "text-amber-700" },
  red: { icone: "text-red-600 bg-red-50", valor: "text-red-700" },
  slate: { icone: "text-graphite-400 bg-graphite-950", valor: "text-graphite-300" },
};

export default function CardIndicadorExecutivo({
  titulo,
  valor,
  icone,
  accent = "brand",
  href,
}: {
  titulo: string;
  valor: string | number;
  /** Atributo `d` de um `<path>` SVG (mesmo padrão de ícone já usado em components/Sidebar.tsx). */
  icone: string;
  accent?: Accent;
  /** Drill-down (revisão): quando informado, o card inteiro vira um link para /suporte já filtrado. */
  href?: string;
}) {
  const cores = ACCENT_MAP[accent];
  const conteudo = (
    <>
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${cores.icone}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icone} />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-graphite-400">{titulo}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${cores.valor}`}>{valor}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card flex items-center gap-4 transition-shadow duration-200 hover:shadow-panel hover:border-neon-500/40"
        title={`Ver chamados: ${titulo}`}
      >
        {conteudo}
      </Link>
    );
  }

  return <div className="card flex items-center gap-4 transition-shadow duration-200 hover:shadow-panel">{conteudo}</div>;
}
