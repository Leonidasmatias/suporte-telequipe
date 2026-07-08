import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { formatarTempo } from "@/lib/suporte";
import { toggleColaboradorStatus } from "../actions";

export const dynamic = "force-dynamic";

const badgeStatus: Record<string, string> = {
  Aberto: "chip-danger",
  "Em Atendimento": "chip-warning",
  Finalizado: "chip-success",
};

/** "há 3 dias", "hoje", "há 2 meses"... a partir de uma data ISO (yyyy-mm-dd). */
function tempoDesde(dataIso: string): string {
  const dias = Math.floor((Date.now() - new Date(`${dataIso}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Há 1 dia";
  if (dias < 30) return `Há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses === 1) return "Há 1 mês";
  if (meses < 12) return `Há ${meses} meses`;
  const anos = Math.floor(meses / 12);
  return anos === 1 ? "Há 1 ano" : `Há ${anos} anos`;
}

export default async function ColaboradorDetalhePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) notFound();

  const colaborador = await prisma.colaborador.findUnique({ where: { id } });
  if (!colaborador) notFound();

  const historico = await prisma.supportTicket.findMany({
    where: { colaboradorId: id },
    orderBy: { dataAtendimento: "desc" },
  });

  const ultimoAtendimento = historico[0] ?? null;
  const ultimaData = ultimoAtendimento ? ultimoAtendimento.dataAtendimento.toISOString().slice(0, 10) : null;

  return (
    <div>
      <PageHeader
        title={colaborador.nome}
        description={[colaborador.cargo, colaborador.empresaNome].filter(Boolean).join(" · ") || "Colaborador"}
        action={
          <div className="flex items-center gap-3">
            <form action={toggleColaboradorStatus}>
              <input type="hidden" name="id" value={colaborador.id} />
              <button
                type="submit"
                className={`badge cursor-pointer transition-opacity hover:opacity-75 ${colaborador.status === "ativo" ? "chip-success" : "chip-neutral"}`}
                title={colaborador.status === "ativo" ? "Clique para marcar como inativo" : "Clique para marcar como ativo"}
              >
                {colaborador.status}
              </button>
            </form>
            <Link href="/colaboradores" className="btn-secondary">
              Voltar para colaboradores
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Atendimentos" value={historico.length} accent="brand" />
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">Último atendimento</p>
          <p className="mt-2 text-sm font-medium text-graphite-100">{ultimaData ?? "—"}</p>
          <p className="mt-1 text-xs text-graphite-500">{ultimaData ? tempoDesde(ultimaData) : "Nenhum atendimento registrado"}</p>
        </div>
        <StatCard
          label="Tempo médio de atendimento"
          value={
            historico.length > 0
              ? formatarTempo(
                  historico.reduce((soma, t) => soma + (t.tempoAtendimento ?? 0), 0) /
                    Math.max(1, historico.filter((t) => t.tempoAtendimento !== null).length)
                )
              : "—"
          }
          accent="amber"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-white">Dados cadastrais</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="label-field">TipoPessoa</dt>
              <dd className="text-graphite-200">{colaborador.tipoPessoa || "—"}</dd>
            </div>
            <div>
              <dt className="label-field">Regional</dt>
              <dd className="text-graphite-200">{colaborador.regional || "—"}</dd>
            </div>
            <div>
              <dt className="label-field">Empresa</dt>
              <dd className="text-graphite-200">{colaborador.empresaNome || "—"}</dd>
            </div>
            <div>
              <dt className="label-field">Cargo</dt>
              <dd className="text-graphite-200">{colaborador.cargo || "—"}</dd>
            </div>
            <div>
              <dt className="label-field">Operadoras/Clientes</dt>
              <dd className="text-graphite-200">{colaborador.operadoras || "—"}</dd>
            </div>
            <div>
              <dt className="label-field">Telefone</dt>
              <dd className="text-graphite-200">{colaborador.telefone || "—"}</dd>
            </div>
            <div>
              <dt className="label-field">Última sincronização</dt>
              <dd className="text-graphite-200">
                {colaborador.dataImportacao ? colaborador.dataImportacao.toISOString().slice(0, 10) : "—"}
              </dd>
            </div>
            <div>
              <dt className="label-field">Última atualização</dt>
              <dd className="text-graphite-200">
                {colaborador.ultimaAtualizacao ? colaborador.ultimaAtualizacao.toISOString().slice(0, 10) : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-white">
            Histórico de Suporte ({historico.length})
          </h2>
          {historico.length === 0 ? (
            <EmptyState message="Nenhum atendimento de suporte registrado para este colaborador ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Problema</th>
                    <th>Observações</th>
                    <th>Tempo</th>
                    <th>Resultado</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((t) => (
                    <tr key={t.id}>
                      <td>{t.dataAtendimento.toISOString().slice(0, 10)}</td>
                      <td>{t.categoria}</td>
                      <td className="max-w-xs truncate">{t.descricaoProblema}</td>
                      <td className="max-w-xs truncate text-graphite-500">{t.observacoes || "—"}</td>
                      <td className="tabular-nums">{formatarTempo(t.tempoAtendimento)}</td>
                      <td>{t.resultado}</td>
                      <td>
                        <span className={`badge ${badgeStatus[t.status] ?? "chip-neutral"}`}>{t.status}</span>
                      </td>
                      <td>
                        <Link href={`/suporte/${t.id}`} className="btn-secondary">Ver</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
