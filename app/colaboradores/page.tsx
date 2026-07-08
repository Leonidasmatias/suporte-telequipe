import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import FiltrosColaboradores from "./FiltrosColaboradores";
import { createColaborador, deleteColaborador, toggleColaboradorStatus } from "./actions";
import { estaEmModoEdicao } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

const PAGE_SIZE = 25;

const CAMPOS_ORDENAVEIS = ["nome", "regional", "empresaNome", "cargo", "status", "ultimaAtualizacao"] as const;
type CampoOrdenavel = (typeof CAMPOS_ORDENAVEIS)[number];

function ehCampoOrdenavel(valor: string): valor is CampoOrdenavel {
  return (CAMPOS_ORDENAVEIS as readonly string[]).includes(valor);
}

export default async function ColaboradoresPage({ searchParams }: { searchParams: SearchParams }) {
  const podeEditar = estaEmModoEdicao();
  const q = primeiro(searchParams.q);
  const tipoPessoa = primeiro(searchParams.tipoPessoa);
  const regional = primeiro(searchParams.regional);
  const empresa = primeiro(searchParams.empresa);
  const cargo = primeiro(searchParams.cargo);
  const status = primeiro(searchParams.status);
  const sortRaw = primeiro(searchParams.sort);
  const sort: CampoOrdenavel = ehCampoOrdenavel(sortRaw) ? sortRaw : "nome";
  const dir: "asc" | "desc" = primeiro(searchParams.dir) === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(primeiro(searchParams.page)) || 1);

  const where: Prisma.ColaboradorWhereInput = {};
  const and: Prisma.ColaboradorWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { operadoras: { contains: q, mode: "insensitive" } },
        { telefone: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (tipoPessoa) and.push({ tipoPessoa });
  if (regional) and.push({ regional });
  if (empresa) and.push({ empresaNome: empresa });
  if (cargo) and.push({ cargo });
  if (status) and.push({ status });
  if (and.length > 0) where.AND = and;

  const [
    totalGeral,
    totalAtivos,
    tipoPessoaBreakdown,
    ultimaImportacaoAgg,
    ultimaAtualizacaoAgg,
    tiposPessoaRaw,
    regionaisRaw,
    empresasRaw,
    cargosRaw,
    totalFiltrado,
    colaboradores,
  ] = await Promise.all([
    prisma.colaborador.count(),
    prisma.colaborador.count({ where: { status: "ativo" } }),
    prisma.colaborador.groupBy({
      by: ["tipoPessoa"],
      where: { tipoPessoa: { not: null } },
      _count: { _all: true },
      orderBy: { tipoPessoa: "asc" },
    }),
    prisma.colaborador.aggregate({ _max: { dataImportacao: true } }),
    prisma.colaborador.aggregate({ _max: { ultimaAtualizacao: true } }),
    prisma.colaborador.findMany({ where: { tipoPessoa: { not: null } }, distinct: ["tipoPessoa"], select: { tipoPessoa: true }, orderBy: { tipoPessoa: "asc" } }),
    prisma.colaborador.findMany({ where: { regional: { not: null } }, distinct: ["regional"], select: { regional: true }, orderBy: { regional: "asc" } }),
    prisma.colaborador.findMany({ where: { empresaNome: { not: null } }, distinct: ["empresaNome"], select: { empresaNome: true }, orderBy: { empresaNome: "asc" } }),
    prisma.colaborador.findMany({ where: { cargo: { not: null } }, distinct: ["cargo"], select: { cargo: true }, orderBy: { cargo: "asc" } }),
    prisma.colaborador.count({ where }),
    prisma.colaborador.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalInativos = totalGeral - totalAtivos;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / PAGE_SIZE));
  const opcoes = {
    tiposPessoa: tiposPessoaRaw.map((t) => t.tipoPessoa!).filter(Boolean),
    regionais: regionaisRaw.map((r) => r.regional!).filter(Boolean),
    empresas: empresasRaw.map((e) => e.empresaNome!).filter(Boolean),
    cargos: cargosRaw.map((c) => c.cargo!).filter(Boolean),
  };

  function linkOrdenacao(campo: CampoOrdenavel, label: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tipoPessoa) params.set("tipoPessoa", tipoPessoa);
    if (regional) params.set("regional", regional);
    if (empresa) params.set("empresa", empresa);
    if (cargo) params.set("cargo", cargo);
    if (status) params.set("status", status);
    params.set("sort", campo);
    params.set("dir", sort === campo && dir === "asc" ? "desc" : "asc");
    const ativo = sort === campo;
    return (
      <Link href={`/colaboradores?${params.toString()}`} className="inline-flex items-center gap-1 hover:text-graphite-100">
        {label}
        {ativo && <span className="text-neon-400">{dir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    );
  }

  function linkPagina(novaPagina: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tipoPessoa) params.set("tipoPessoa", tipoPessoa);
    if (regional) params.set("regional", regional);
    if (empresa) params.set("empresa", empresa);
    if (cargo) params.set("cargo", cargo);
    if (status) params.set("status", status);
    params.set("sort", sort);
    params.set("dir", dir);
    params.set("page", String(novaPagina));
    return `/colaboradores?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        description="Cadastro Mestre de Colaboradores — fonte única de verdade, sincronizada por Importação Massiva (Smart Sync)."
        action={
          <Link href="/importacao" className="btn-primary">
            Importar planilha
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Total de colaboradores" value={totalGeral} accent="brand" />
        <StatCard label="Ativos" value={totalAtivos} accent="green" />
        <StatCard label="Inativos" value={totalInativos} accent="slate" />
        {tipoPessoaBreakdown.map((t, i) => (
          <StatCard
            key={t.tipoPessoa}
            label={t.tipoPessoa!}
            value={t._count._all}
            accent={(["brand", "amber", "green", "slate"] as const)[i % 4]}
          />
        ))}
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">Última sincronização</p>
          <p className="mt-2 text-sm font-medium text-graphite-100">
            {ultimaImportacaoAgg._max.dataImportacao
              ? ultimaImportacaoAgg._max.dataImportacao.toISOString().slice(0, 16).replace("T", " ")
              : "—"}
          </p>
          <p className="mt-1 text-xs text-graphite-500">
            Última atualização:{" "}
            {ultimaAtualizacaoAgg._max.ultimaAtualizacao
              ? ultimaAtualizacaoAgg._max.ultimaAtualizacao.toISOString().slice(0, 16).replace("T", " ")
              : "—"}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Suspense fallback={<div className="card h-[172px] animate-pulse" />}>
          <FiltrosColaboradores opcoes={opcoes} />
        </Suspense>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold text-white">Novo colaborador</h2>
          <p className="mb-4 text-xs text-graphite-500">
            Cadastro manual pontual. A forma oficial de manter o Cadastro Mestre atualizado é a Importação Massiva.
          </p>
          {podeEditar ? (
            <form action={createColaborador} className="space-y-4">
              <div>
                <label className="label-field">Nome</label>
                <input name="nome" required className="input-field" placeholder="Nome completo" />
              </div>
              <div>
                <label className="label-field">TipoPessoa</label>
                <input name="tipo_pessoa" className="input-field" placeholder="Ex: CLT, PJ" />
              </div>
              <div>
                <label className="label-field">Regional</label>
                <input name="regional" className="input-field" placeholder="Ex: Regional Sul" />
              </div>
              <div>
                <label className="label-field">Operadoras/Clientes</label>
                <input name="operadoras" className="input-field" placeholder="Ex: ERICSSON/NOKIA" />
              </div>
              <div>
                <label className="label-field">Empresa</label>
                <input name="empresa_nome" className="input-field" placeholder="Nome da empresa" />
              </div>
              <div>
                <label className="label-field">Cargo</label>
                <input name="cargo" className="input-field" placeholder="Ex: Instalador Senior I" />
              </div>
              <div>
                <label className="label-field">Telefone</label>
                <input name="telefone" className="input-field" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="label-field">Status</label>
                <select name="status" className="input-field" defaultValue="ativo">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full">Cadastrar colaborador</button>
            </form>
          ) : (
            <p className="rounded-lg border border-graphite-700 bg-graphite-900/40 px-4 py-3 text-xs text-graphite-500">
              Modo de visualização — destrave a edição na barra lateral para cadastrar.
            </p>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-white">
            Colaboradores ({totalFiltrado} de {totalGeral})
          </h2>
          {colaboradores.length === 0 ? (
            <EmptyState message="Nenhum colaborador encontrado para os filtros selecionados." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{linkOrdenacao("nome", "Nome")}</th>
                      <th>TipoPessoa</th>
                      <th>{linkOrdenacao("regional", "Regional")}</th>
                      <th>{linkOrdenacao("empresaNome", "Empresa")}</th>
                      <th>{linkOrdenacao("cargo", "Cargo")}</th>
                      <th>Operadoras/Clientes</th>
                      <th>Telefone</th>
                      <th>{linkOrdenacao("status", "Status")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {colaboradores.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium text-white">{c.nome}</td>
                        <td>{c.tipoPessoa || "—"}</td>
                        <td>{c.regional || "—"}</td>
                        <td>{c.empresaNome || "—"}</td>
                        <td>{c.cargo || "—"}</td>
                        <td className="text-xs">{c.operadoras || "—"}</td>
                        <td>{c.telefone || "—"}</td>
                        <td>
                          {podeEditar ? (
                            <form action={toggleColaboradorStatus}>
                              <input type="hidden" name="id" value={c.id} />
                              <button
                                type="submit"
                                className={`badge cursor-pointer transition-opacity hover:opacity-75 ${c.status === "ativo" ? "chip-success" : "chip-neutral"}`}
                                title={c.status === "ativo" ? "Clique para marcar como inativo" : "Clique para marcar como ativo"}
                              >
                                {c.status}
                              </button>
                            </form>
                          ) : (
                            <span className={`badge ${c.status === "ativo" ? "chip-success" : "chip-neutral"}`}>{c.status}</span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Link href={`/colaboradores/${c.id}`} className="btn-secondary">Ver histórico</Link>
                            {podeEditar && (
                              <form action={deleteColaborador}>
                                <input type="hidden" name="id" value={c.id} />
                                <button type="submit" className="btn-danger">Remover</button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm text-graphite-400">
                <span>
                  Página {page} de {totalPaginas}
                </span>
                <div className="flex gap-2">
                  <Link
                    href={linkPagina(Math.max(1, page - 1))}
                    className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                  >
                    Anterior
                  </Link>
                  <Link
                    href={linkPagina(Math.min(totalPaginas, page + 1))}
                    className={`btn-secondary ${page >= totalPaginas ? "pointer-events-none opacity-40" : ""}`}
                  >
                    Próxima
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
