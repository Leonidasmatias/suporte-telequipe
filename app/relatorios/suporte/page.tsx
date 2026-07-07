import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import {
  buildWhereSuporte,
  getIndicadoresSuporte,
  formatarTempo,
  RESULTADOS_SUPORTE,
  type FiltrosSuporte,
} from "@/lib/suporte";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

/**
 * Página de relatórios da Central de Suporte Técnico.
 *
 * A exportação para Excel/PDF está estruturada mas propositalmente NÃO
 * implementada nesta etapa (conforme escopo solicitado). Os botões abaixo
 * indicam onde a geração de arquivo entrará: cada um chamaria uma rota
 * dedicada (ex: /api/relatorios/suporte/exportar?formato=xlsx|pdf) que
 * reaproveitaria exatamente o mesmo `buildWhereSuporte(filtros)` usado
 * aqui para montar o relatório filtrado.
 */
export default async function RelatorioSuportePage({ searchParams }: { searchParams: SearchParams }) {
  const filtros: FiltrosSuporte = {
    dataInicio: primeiro(searchParams.data_inicio) || undefined,
    dataFim: primeiro(searchParams.data_fim) || undefined,
    colaboradorId: primeiro(searchParams.colaborador_id) ? Number(primeiro(searchParams.colaborador_id)) : undefined,
    projeto: primeiro(searchParams.projeto) || undefined,
  };
  const resultadoFiltro = primeiro(searchParams.resultado) || undefined;
  const clienteFiltro = primeiro(searchParams.cliente) || undefined;

  const [colaboradores, indicadores, ticketsRaw] = await Promise.all([
    prisma.colaborador.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    getIndicadoresSuporte(filtros),
    prisma.supportTicket.findMany({
      where: {
        ...buildWhereSuporte(filtros),
        ...(resultadoFiltro ? { resultado: resultadoFiltro } : {}),
        ...(clienteFiltro ? { cliente: { contains: clienteFiltro, mode: "insensitive" } } : {}),
      },
      include: { colaborador: true },
      orderBy: { dataAtendimento: "desc" },
    }),
  ]);

  const tickets = ticketsRaw.map((t) => ({
    id: t.id,
    numero: t.numero,
    dataAtendimento: t.dataAtendimento.toISOString().slice(0, 10),
    colaboradorNome: t.colaborador?.nome ?? t.liderNomeHistorico ?? null,
    projeto: t.projeto,
    cliente: t.cliente,
    categoria: t.categoria,
    tempoAtendimento: t.tempoAtendimento,
    resultado: t.resultado,
    status: t.status,
  }));

  return (
    <div>
      <PageHeader
        title="Relatórios — Suporte Técnico"
        description="Relatório filtrado de atendimentos técnicos, pronto para exportação futura."
        action={
          <div className="flex gap-2">
            <button type="button" disabled title="Exportação em preparação" className="btn-secondary opacity-50">
              Exportar Excel
            </button>
            <button type="button" disabled title="Exportação em preparação" className="btn-secondary opacity-50">
              Exportar PDF
            </button>
          </div>
        }
      />

      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-white">Filtros</h2>
        <form action="/relatorios/suporte" method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label-field">Período — de</label>
            <input type="date" name="data_inicio" defaultValue={filtros.dataInicio} className="input-field" />
          </div>
          <div>
            <label className="label-field">Período — até</label>
            <input type="date" name="data_fim" defaultValue={filtros.dataFim} className="input-field" />
          </div>
          <div>
            <label className="label-field">Projeto</label>
            <input name="projeto" defaultValue={filtros.projeto} className="input-field" placeholder="Nome do projeto" />
          </div>
          <div>
            <label className="label-field">Colaborador</label>
            <select name="colaborador_id" defaultValue={filtros.colaboradorId ?? ""} className="input-field">
              <option value="">Todos</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Cliente</label>
            <input name="cliente" defaultValue={clienteFiltro} className="input-field" placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="label-field">Resultado</label>
            <select name="resultado" defaultValue={resultadoFiltro ?? ""} className="input-field">
              <option value="">Todos</option>
              {RESULTADOS_SUPORTE.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Gerar relatório</button>
          </div>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de atendimentos" value={indicadores.totalAtendimentos} accent="brand" />
        <StatCard
          label="Tempo médio"
          value={indicadores.tempoMedioGeral !== null ? formatarTempo(indicadores.tempoMedioGeral) : "—"}
          accent="amber"
        />
        <StatCard label="Pendências abertas" value={indicadores.pendenciasAbertas} accent="slate" />
        <StatCard
          label="Resolvidos na 1ª intervenção"
          value={`${indicadores.percentualResolvidoPrimeiraIntervencao}%`}
          accent="green"
        />
      </div>

      <div className="mt-6 card">
        <h2 className="mb-4 text-base font-semibold text-white">Atendimentos ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <EmptyState message="Nenhum atendimento encontrado para os filtros selecionados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Data</th>
                  <th>Colaborador</th>
                  <th>Projeto</th>
                  <th>Cliente</th>
                  <th>Categoria</th>
                  <th>Tempo</th>
                  <th>Resultado</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-white">#{t.numero}</td>
                    <td>{t.dataAtendimento}</td>
                    <td>{t.colaboradorNome || "—"}</td>
                    <td>{t.projeto || "—"}</td>
                    <td>{t.cliente || "—"}</td>
                    <td>{t.categoria}</td>
                    <td className="tabular-nums">{formatarTempo(t.tempoAtendimento)}</td>
                    <td>{t.resultado}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
