import Link from "next/link";
import EmptyState from "./EmptyState";

/**
 * Sprint "v7.2 — Dashboard Executivo de Suporte".
 *
 * Gráfico de evolução temporal (chamados por dia) da tela
 * /suporte/dashboard, em barras verticais simples (CSS puro, sem nenhuma
 * biblioteca de gráficos nova instalada — mantém o footprint de dependências
 * do projeto exatamente como está). Componente NOVO.
 *
 * "Prever suporte para crescimento futuro" (regra explícita da missão): a
 * agregação em `lib/dashboardSuporte.ts` (`getIndicadoresExecutivosSuporte`)
 * já cobre TODO o histórico em escopo, em uma única passagem — o corte de
 * quantos dias efetivamente aparecem no gráfico é só uma decisão de
 * EXIBIÇÃO, feita pela página (ver `app/suporte/dashboard/page.tsx`,
 * constante `DIAS_EXIBIDOS_EVOLUCAO`), então o gráfico continua funcionando
 * sem nenhuma mudança de código à medida que a quantidade de atendimentos
 * crescer — só o recorte de "quantos dias mostrar" precisaria ser ajustado,
 * se um dia for necessário.
 */
function formatarDataCurta(dataIso: string): string {
  const [, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}`;
}

export default function GraficoEvolucaoDiaria({
  pontos,
  montarHref,
}: {
  pontos: { data: string; quantidade: number }[];
  /** Drill-down (revisão): constrói a URL de /suporte para o dia da barra; `null`/`undefined` = barra não clicável. */
  montarHref?: (data: string) => string | null | undefined;
}) {
  if (pontos.length === 0) {
    return <EmptyState message="Nenhum dado disponível" />;
  }

  const maximo = Math.max(...pontos.map((p) => p.quantidade), 1);

  return (
    <div>
      <div className="flex h-36 items-end gap-1">
        {pontos.map((p) => {
          const href = montarHref?.(p.data);
          const barra = (
            <div
              className="w-full rounded-t bg-neon-500 transition-colors duration-150 group-hover:bg-neon-600"
              style={{ height: `${p.quantidade > 0 ? Math.max((p.quantidade / maximo) * 100, 4) : 0}%` }}
            />
          );
          return href ? (
            <Link
              key={p.data}
              href={href}
              className="group relative flex-1"
              title={`${formatarDataCurta(p.data)}: ${p.quantidade} chamado${p.quantidade === 1 ? "" : "s"}`}
            >
              {barra}
            </Link>
          ) : (
            <div
              key={p.data}
              className="group relative flex-1"
              title={`${formatarDataCurta(p.data)}: ${p.quantidade} chamado${p.quantidade === 1 ? "" : "s"}`}
            >
              {barra}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-graphite-500">
        <span>{formatarDataCurta(pontos[0].data)}</span>
        <span>{formatarDataCurta(pontos[pontos.length - 1].data)}</span>
      </div>
    </div>
  );
}
