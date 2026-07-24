import EmptyState from "./EmptyState";
import { REGIONAL_NAO_CLASSIFICADA, COMBINACAO_HISTORICA } from "@/lib/projetoRegional";
import type { ContagemProjetoRegional } from "@/lib/dashboardSuporte";

/**
 * Sprint "TELEQUIPE SUPORTE STA — Evolução 7.1".
 *
 * Gráfico NOVO "Chamados por Projeto e Regional" do Dashboard Executivo —
 * barras horizontais EMPILHADAS (cada Projeto é uma barra única, dividida em
 * segmentos coloridos proporcionais à distribuição entre as Regionais
 * daquele Projeto), sem nenhuma biblioteca de gráficos nova (mesmo
 * footprint de dependências do projeto — CSS puro, mesmo padrão já usado por
 * `BarraDistribuicao`/`GraficoEvolucaoDiaria`).
 *
 * Dados: recebidos já prontos de `calcularChamadosPorProjetoRegional`
 * (lib/dashboardSuporte.ts) — função pura que já aplica o mesmo `where`
 * (escopo + Filtros Globais) da consulta única do Dashboard, nunca uma
 * consulta própria (sem risco de contar um chamado duas vezes ou divergir
 * dos demais indicadores da página).
 *
 * Tooltip: nativo (`title` em cada segmento), sem JS adicional — "Projeto:
 * X · Regional: Y · Quantidade: Z chamados".
 *
 * Acessibilidade: a barra em si é decorativa (`aria-hidden`); um resumo
 * textual equivalente (`sr-only`, só para leitor de tela) descreve a mesma
 * informação em texto corrido, por Projeto e Regional.
 *
 * Este componente NÃO adiciona nenhum link de drill-down (diferente de
 * `BarraDistribuicao`) — não existe hoje, em `/suporte` (listagem), um
 * filtro para o Regional do PRÓPRIO chamado (só para o Regional do
 * Colaborador, conceito diferente — ver lib/projetoRegional.ts). Adicionar
 * um novo parâmetro de URL para isso estaria fora do escopo desta entrega
 * (ver limitações no relatório final).
 */

// Paleta fixa por código de Regional (cobre todos os 8 códigos oficiais da
// matriz) + os 3 buckets especiais de dado histórico/não classificado
// (sempre cinza `graphite-500`, mesma convenção já usada por
// NAO_CLASSIFICADO/REGIONAL_NAO_INFORMADA/TECNICO_NAO_INFORMADO em
// lib/dashboardSuporte.ts).
const CORES_REGIONAL: Record<string, string> = {
  SP: "bg-neon-500",
  MG: "bg-emerald-500",
  BASE: "bg-amber-500",
  CO: "bg-teal-500",
  NO: "bg-rose-500",
  RJ: "bg-info-500",
  SM: "bg-sky-500",
  SI: "bg-purple-500",
  [REGIONAL_NAO_CLASSIFICADA]: "bg-graphite-500",
  [COMBINACAO_HISTORICA]: "bg-graphite-600",
};
const COR_PADRAO = "bg-graphite-400";

function corDoSegmento(regional: string): string {
  return CORES_REGIONAL[regional] ?? COR_PADRAO;
}

export default function GraficoProjetoRegional({ dados }: { dados: ContagemProjetoRegional[] }) {
  if (dados.length === 0) {
    return <EmptyState message="Nenhum dado disponível" />;
  }

  const maximo = Math.max(...dados.map((d) => d.total), 1);

  // Legenda: união de todas as Regionais/buckets que efetivamente aparecem
  // nos dados exibidos (nunca a lista completa da matriz — só o que existe
  // no período/filtro atual), na ordem em que aparecem pela primeira vez.
  const legenda: string[] = [];
  for (const d of dados) {
    for (const regional of Object.keys(d.regionais)) {
      if (!legenda.includes(regional)) legenda.push(regional);
    }
  }

  return (
    <div>
      <div className="space-y-4" aria-hidden>
        {dados.map((d) => (
          <div key={d.projeto} className="flex items-center gap-3">
            <span className="w-40 flex-shrink-0 truncate text-xs text-graphite-400" title={d.projeto}>
              {d.projeto}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-graphite-700">
              <div className="flex h-full" style={{ width: `${(d.total / maximo) * 100}%` }}>
                {Object.entries(d.regionais).map(([regional, quantidade]) => (
                  <div
                    key={regional}
                    className={`h-full transition-[width] duration-500 ease-out ${corDoSegmento(regional)}`}
                    style={{ width: `${(quantidade / d.total) * 100}%` }}
                    title={`Projeto: ${d.projeto} · Regional: ${regional} · Quantidade: ${quantidade} ${
                      quantidade === 1 ? "chamado" : "chamados"
                    }`}
                  />
                ))}
              </div>
            </div>
            <span className="w-10 flex-shrink-0 text-right text-xs font-medium tabular-nums text-graphite-300">
              {d.total}
            </span>
          </div>
        ))}
      </div>

      {/* Legenda — mesmas cores dos segmentos acima, com contraste de texto suficiente (WCAG AA) sobre fundo escuro. */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-graphite-800 pt-3">
        {legenda.map((regional) => (
          <span key={regional} className="flex items-center gap-1.5 text-xs text-graphite-400">
            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${corDoSegmento(regional)}`} aria-hidden />
            {regional}
          </span>
        ))}
      </div>

      {/* Resumo textual equivalente, só para leitor de tela (o gráfico acima é aria-hidden) — mission "Evolução 7.1", item 12 (acessibilidade). */}
      <ul className="sr-only">
        {dados.map((d) => (
          <li key={d.projeto}>
            {d.projeto}: {d.total} {d.total === 1 ? "chamado" : "chamados"} no total
            {Object.entries(d.regionais).length > 0 && (
              <>
                {" "}
                (
                {Object.entries(d.regionais)
                  .map(([regional, quantidade]) => `${regional}: ${quantidade}`)
                  .join(", ")}
                )
              </>
            )}
            .
          </li>
        ))}
      </ul>
    </div>
  );
}
