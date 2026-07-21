import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { createTreinamento, deleteTreinamento } from "./actions";
import { ACOES, RECURSOS, canPerform, requireAccess } from "@/lib/autorizacao";

export const dynamic = "force-dynamic";

export default async function TreinamentosPage() {
  const usuario = await requireAccess(RECURSOS.treinamentos);
  const podeEditar = canPerform(usuario, ACOES["treinamentos.escrever"]);
  const treinamentosRaw = await prisma.treinamento.findMany({
    include: { colaboradores: true },
    orderBy: { createdAt: "desc" },
  });

  const treinamentos = treinamentosRaw.map((t) => ({
    id: t.id,
    nome: t.titulo,
    categoria: t.categoria,
    cargaHoraria: t.cargaHoraria,
    data: t.data ? t.data.toISOString().slice(0, 10) : null,
    participantes: t.colaboradores.length,
  }));

  return (
    <div>
      <PageHeader title="Treinamentos" description="Capacitações técnicas e certificações realizadas pela equipe." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-white">Novo treinamento</h2>
          {podeEditar ? (
            <form action={createTreinamento} className="space-y-4">
              <div>
                <label className="label-field">Nome</label>
                <input name="nome" required className="input-field" placeholder="Ex: Certificação Nokia AirScale" />
              </div>
              <div>
                <label className="label-field">Categoria</label>
                <input name="categoria" className="input-field" placeholder="Ex: Certificação Nokia" />
              </div>
              <div>
                <label className="label-field">Carga horária (h)</label>
                <input name="carga_horaria" type="number" min={0} className="input-field" placeholder="0" />
              </div>
              <div>
                <label className="label-field">Data de realização</label>
                <input name="data_realizacao" type="date" className="input-field" />
              </div>
              <div>
                <label className="label-field">Instrutor</label>
                <input name="instrutor" className="input-field" placeholder="Nome do instrutor" />
              </div>
              <button type="submit" className="btn-primary w-full">Cadastrar treinamento</button>
            </form>
          ) : (
            <p className="rounded-lg border border-graphite-700 bg-graphite-900/40 px-4 py-3 text-xs text-graphite-500">
              Seu perfil não tem permissão para cadastrar treinamentos.
            </p>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-white">
            Treinamentos cadastrados ({treinamentos.length})
          </h2>
          {treinamentos.length === 0 ? (
            <EmptyState message="Nenhum treinamento cadastrado ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Carga</th>
                    <th>Data</th>
                    <th>Participantes</th>
                    {podeEditar && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {treinamentos.map((t) => (
                    <tr key={t.id}>
                      <td className="font-medium text-white">{t.nome}</td>
                      <td>{t.categoria || "—"}</td>
                      <td>{t.cargaHoraria ? `${t.cargaHoraria}h` : "—"}</td>
                      <td>{t.data || "—"}</td>
                      <td>
                        <span className="badge chip-success">{t.participantes}</span>
                      </td>
                      {podeEditar && (
                        <td>
                          <form action={deleteTreinamento}>
                            <input type="hidden" name="id" value={t.id} />
                            <button type="submit" className="btn-danger">Remover</button>
                          </form>
                        </td>
                      )}
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
