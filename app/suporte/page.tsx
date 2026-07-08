import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import {
  buildWhereSuporte,
  getIndicadoresSuporte,
  getKpisSuporte,
  getUltimosAtendimentos,
  formatarTempo,
  CATEGORIAS_SUPORTE,
  STATUS_SUPORTE,
  type FiltrosSuporte,
} from "@/lib/suporte";
import { estaEmModoEdicao } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

const badgeStatus: Record<string, string> = {
  Aberto: "chip-danger",
  "Em Atendimento": "chip-warning",
  Finalizado: "chip-success",
};

const badgeResultado: Record<string, string> = {
  Resolvido: "chip-success",
  "Resolvido Parcialmente": "chip-warning",
  "Encaminhado Engenharia": "chip-info",
  "Aguardando Cliente": "chip-neutral",
  "Aguardando Material": "chip-neutral",
  Cancelado: "chip-danger",
};

export default async function SuportePage({ searchParams }: { searchParams: SearchParams }) {
  const podeEditar = estaEmModoEdicao();
  const filtros: FiltrosSuporte = {
    dataInicio: primeiro(searchParams.data_inicio) || undefined,
    dataFim: primeiro(searchParams.data_fim) || undefined,
    colaboradorId: primeiro(searchParams.colaborador_id) ? Number(primeiro(searchParams.colaborador_id)) : undefined,
    projeto: primeiro(searchParams.projeto) || undefined,
    categoria: primeiro(searchParams.categoria) || undefined,
    status: primeiro(searchParams.status) || undefined,
    tecnico: primeiro(searchParams.tecnico) || undefined,
    busca: primeiro(searchParams.busca) || undefined,
  };

  const [kpis, indicadores, ultimosAtendimentos, colaboradores, ticketsRaw] = await Promise.all([
    getKpisSuporte(),
    getIndicadoresSuporte(filtros),
    getUltimosAtendimentos(5),
    prisma.colaborador.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.supportTicket.findMany({
      where: buildWhereSuporte(filtros),
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
    categoria: t.categoria,
    tempoAtendimento: t.tempoAtendimento,
    resultado: t.resultado,
    status: t.status,
  }));

  return (
    <div>
      <PageHeader
        title="Suporte Técnico"
        description="Central de atendimento técnico aos colaboradores de campo — banco de conhecimento operacional."
        action={
          podeEditar ? (
            <Link href="/suporte/novo" className="btn-primary">
              Novo atendimento
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Atendimentos hoje" value={kpis.atendimentosHoje} accent="brand" />
        <StatCard label="Atendimentos no mês" value={kpis.atendimentosMes} accent="slate" />
        <StatCard
          label="Tempo médio"
          value={kpis.tempoMedioMinutos !== null ? formatarTempo(kpis.tempoMedioMinutos) : "—"}
          accent="amber"
        />
        <StatCard label="Resolvidos hoje" value={kpis.resolvidosHoje} accent="green" />
        <StatCard label="Pendentes" value={kpis.pendentes} accent="brand" />
      </div>

      <div className="mt-8 card">
        <h2 className="mb-4 text-base font-semibold text-white">Filtros e busca</h2>
        <form action="/suporte" method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label-field">Período — de</label>
            <input type="date" name="data_inicio" defaultValue={filtros.dataInicio} className="input-field" />
          </div>
          <div>
            <label className="label-field">Período — até</label>
            <input type="date" name="data_fim" defaultValue={filtros.dataFim} className="input-field" />
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
            <label className="label-field">Projeto</label>
            <input name="projeto" defaultValue={filtros.projeto} className="input-field" placeholder="Nome do projeto" />
          </div>
          <div>
            <label className="label-field">Categoria</label>
            <select name="categoria" defaultValue={filtros.categoria ?? ""} className="input-field">
              <option value="">Todas</option>
              {CATEGORIAS_SUPORTE.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Status</label>
            <select name="status" defaultValue={filtros.status ?? ""} className="input-field">
              <option value="">Todos</option>
              {STATUS_SUPORTE.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Técnico responsável</label>
            <input name="tecnico" defaultValue={filtros.tecnico} className="input-field" placeholder="Nome do técnico" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label-field">Buscar (colaborador, projeto, categoria ou número)</label>
            <input name="busca" defaultValue={filtros.busca} className="input-field" placeholder="Digite para buscar..." />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary w-full">Filtrar</button>
            <Link href="/suporte" className="btn-secondary w-full text-center">Limpar</Link>
          </div>
        </form>
      </div>

      <div className="mt-8 card">
        <h2 className="mb-4 text-base font-semibold text-white">
          Atendimentos ({tickets.length})
        </h2>
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
                  <th>Categoria</th>
                  <th>Tempo</th>
                  <th>Resultado</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium text-white">#{t.numero}</td>
                    <td>{t.dataAtendimento}</td>
                    <td>{t.colaboradorNome || "—"}</td>
                    <td>{t.projeto || "—"}</td>
                    <td>{t.categoria}</td>
                    <td className="tabular-nums">{formatarTempo(t.tempoAtendimento)}</td>
                    <td>
                      <span className={`badge ${badgeResultado[t.resultado] ?? "chip-neutral"}`}>
                        {t.resultado}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${badgeStatus[t.status] ?? "chip-neutral"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/suporte/${t.id}`} className="btn-secondary">Ver detalhes</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-white">Últimos atendimentos</h2>
          {ultimosAtendimentos.length === 0 ? (
            <EmptyState message="Nenhum atendimento registrado ainda." />
          ) : (
            <div className="space-y-3">
              {ultimosAtendimentos.map((t) => (
                <Link
                  key={t.id}
                  href={`/suporte/${t.id}`}
                  className="flex items-center justify-between rounded-lg border border-graphite-700 bg-graphite-900/40 px-4 py-3 transition-colors duration-150 hover:border-neon-500/40 hover:bg-neon-500/[0.03]"
                >
                  <div>
                    <p className="text-sm font-medium text-graphite-100">
                      #{t.numero} · {t.categoria}
                    </p>
                    <p className="text-xs text-graphite-500">
                      {t.colaboradorNome ?? "Sem colaborador"} · {t.dataAtendimento}
                    </p>
                  </div>
                  <span className={`badge ${badgeStatus[t.status] ?? "chip-neutral"}`}>
                    {t.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-white">Indicadores automáticos</h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-500">Top categorias</p>
              {indicadores.topCategorias.length === 0 ? (
                <p className="text-xs text-graphite-600">Sem dados suficientes.</p>
              ) : (
                <div className="space-y-1.5">
                  {indicadores.topCategorias.map((c) => (
                    <div key={c.nome} className="flex items-center justify-between text-sm">
                      <span className="text-graphite-300">{c.nome}</span>
                      <span className="badge chip-success tabular-nums">{c.quantidade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite-500">Colaboradores que mais solicitam suporte</p>
              {indicadores.topColaboradores.length === 0 ? (
                <p className="text-xs text-graphite-600">Sem dados suficientes.</p>
              ) : (
                <div className="space-y-1.5">
                  {indicadores.topColaboradores.map((c) => (
                    <div key={c.nome} className="flex items-center justify-between text-sm">
                      <span className="text-graphite-300">{c.nome}</span>
                      <span className="badge chip-neutral tabular-nums">{c.quantidade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-graphite-800 pt-3 text-sm">
              <span className="text-graphite-400">Resolvidos na 1ª intervenção</span>
              <span className="font-semibold tabular-nums text-white">
                {indicadores.percentualResolvidoPrimeiraIntervencao}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
