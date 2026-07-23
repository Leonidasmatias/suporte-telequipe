import Link from "next/link";
import EmptyState from "./EmptyState";

/**
 * Sprint "v7.2 — Dashboard Executivo de Suporte" + REVISÃO.
 *
 * Lista de barras horizontais (nome + barra proporcional + quantidade),
 * reutilizada por todos os gráficos de distribuição e rankings Top 10 da
 * tela /suporte/dashboard — evita duplicar o mesmo layout de barra em cada
 * painel. Componente NOVO (não é uma alteração de `components/ScoreBar.tsx`,
 * que continua servindo só ao seu único uso já homologado em /home) — mesma
 * linguagem visual (trilho `bg-graphite-700` arredondado + barra colorida),
 * generalizada para uma lista de itens com escala relativa ao maior valor.
 *
 * "Nenhum dado disponível" (regra explícita da missão para quando não há
 * registros suficientes) é exibido através do já existente
 * `components/EmptyState.tsx`, sem nenhuma alteração nesse componente.
 *
 * DRILL DOWN (revisão): `montarHref`, quando informado, transforma cada linha
 * clicável em um `<Link>` para a listagem de /suporte já filtrada pela
 * dimensão daquela linha. Retornar `null`/`undefined` para um nome específico
 * (ex.: o bucket "Não classificado") mantém aquela linha como texto simples,
 * já que nem todo bucket tem um filtro equivalente em /suporte.
 */
export default function BarraDistribuicao({
  itens,
  corPadrao = "bg-neon-500",
  corPorNome,
  montarHref,
}: {
  itens: { nome: string; quantidade: number }[];
  /** Classe Tailwind `bg-*` usada quando `corPorNome` não tem uma entrada para o item. */
  corPadrao?: string;
  /** Cor específica por nome de item (ex.: um mapa de status → cor semântica). */
  corPorNome?: Record<string, string>;
  /** Constrói a URL de drill-down para uma linha; `null`/`undefined` = linha não clicável. */
  montarHref?: (nome: string) => string | null | undefined;
}) {
  const total = itens.reduce((soma, item) => soma + item.quantidade, 0);
  if (itens.length === 0 || total === 0) {
    return <EmptyState message="Nenhum dado disponível" />;
  }

  const maximo = Math.max(...itens.map((item) => item.quantidade), 1);

  return (
    <div className="space-y-2.5">
      {itens.map((item) => {
        const href = montarHref?.(item.nome);
        const conteudo = (
          <div className="flex items-center gap-3">
            <span className="w-40 flex-shrink-0 truncate text-xs text-graphite-400" title={item.nome}>
              {item.nome}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-graphite-700">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${corPorNome?.[item.nome] ?? corPadrao}`}
                style={{ width: `${(item.quantidade / maximo) * 100}%` }}
              />
            </div>
            <span className="w-10 flex-shrink-0 text-right text-xs font-medium tabular-nums text-graphite-300">
              {item.quantidade}
            </span>
          </div>
        );

        if (href) {
          return (
            <Link
              key={item.nome}
              href={href}
              className="-mx-2 block rounded-md px-2 py-0.5 transition-colors duration-150 hover:bg-neon-500/[0.06]"
              title={`Ver chamados: ${item.nome}`}
            >
              {conteudo}
            </Link>
          );
        }
        return <div key={item.nome}>{conteudo}</div>;
      })}
    </div>
  );
}
