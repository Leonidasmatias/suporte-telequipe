"use client";

import { useState } from "react";
import Link from "next/link";
import {
  analisarPlanilhaColaboradores,
  confirmarSincronizacao,
  type ConfirmarSincronizacaoResultado,
} from "../colaboradores/actions";
import type { ColaboradorImportado, ResultadoAnaliseColaboradores } from "@/lib/colaboradores";

const badgeStatus: Record<string, string> = {
  novo: "chip-success",
  atualizacao: "chip-info",
  sem_alteracao: "chip-neutral",
};

const rotuloStatus: Record<string, string> = {
  novo: "Novo",
  atualizacao: "Atualização",
  sem_alteracao: "Sem alteração",
};

export default function ImportadorColaboradores() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [preview, setPreview] = useState<ResultadoAnaliseColaboradores | null>(null);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<ConfirmarSincronizacaoResultado | null>(null);

  async function handleAnalisar() {
    if (!arquivo) return;
    setAnalisando(true);
    setErroAnalise(null);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const resultadoAnalise = await analisarPlanilhaColaboradores(fd);
      setPreview(resultadoAnalise);
    } catch {
      setErroAnalise("Não foi possível analisar o arquivo. Tente novamente.");
    } finally {
      setAnalisando(false);
    }
  }

  async function handleConfirmar() {
    if (!preview) return;
    setSincronizando(true);
    try {
      const res = await confirmarSincronizacao(preview.pessoas);
      setResultado(res);
    } catch {
      setResultado({ ok: false, erro: "Falha inesperada ao gravar a sincronização. Nada foi salvo." });
    } finally {
      setSincronizando(false);
    }
  }

  function reiniciar() {
    setArquivo(null);
    setPreview(null);
    setErroAnalise(null);
    setResultado(null);
  }

  if (resultado?.ok) {
    const r = resultado.relatorio;
    return (
      <div className="card animate-slide-up border-neon-500/25 bg-neon-500/[0.04]">
        <div className="mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neon-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-base font-semibold text-white">Importação concluída</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ResumoItem label="Novos" valor={r.novos} />
          <ResumoItem label="Atualizados" valor={r.atualizados} />
          <ResumoItem label="Mantidos" valor={r.mantidos} />
          <ResumoItem label="Inativados" valor={r.inativados} />
          <ResumoItem label="Erros" valor={r.erros} />
          <ResumoItem label="Tempo (ms)" valor={r.tempoProcessamentoMs} />
        </div>
        <div className="mt-5 flex gap-3">
          <Link href="/colaboradores" className="btn-primary">Ver Cadastro Mestre</Link>
          <button type="button" onClick={reiniciar} className="btn-secondary">Nova importação</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-white">1. Selecionar arquivo Excel</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="input-field max-w-sm file:mr-3 file:rounded-md file:border-0 file:bg-graphite-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-graphite-200"
          />
          <button type="button" onClick={handleAnalisar} disabled={!arquivo || analisando} className="btn-primary">
            {analisando ? "Validando..." : "Validar planilha"}
          </button>
          {preview && (
            <button type="button" onClick={reiniciar} className="btn-secondary">
              Cancelar / novo arquivo
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-graphite-500">
          Layout oficial: Nome, TipoPessoa, Regional, Cadastro, EmpresaNome, Cargo, Telefone.
        </p>
        {erroAnalise && <p className="mt-3 text-sm text-red-400">{erroAnalise}</p>}
      </div>

      {resultado && !resultado.ok && (
        <div className="card animate-slide-up border-red-500/25 bg-red-500/[0.04]">
          <p className="text-sm font-medium text-red-400">{resultado.erro}</p>
        </div>
      )}

      {preview && (
        <>
          <div className="card animate-slide-up">
            <h2 className="mb-4 text-base font-semibold text-white">2. Pré-visualização (Smart Sync)</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResumoItem label="Total na planilha" valor={preview.totalLinhas} />
              <ResumoItem label="Novos" valor={preview.novos} />
              <ResumoItem label="Atualizações" valor={preview.atualizacoes} />
              <ResumoItem label="Sem alteração" valor={preview.semAlteracao} />
            </div>

            {preview.errosGlobais.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Erros</p>
                <ul className="mt-1 list-inside list-disc text-sm text-red-300">
                  {preview.errosGlobais.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.comErro > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                <p className="text-sm text-amber-400">
                  {preview.comErro} linha(s) com erro serão ignoradas na sincronização — corrija e reenvie se necessário.
                </p>
              </div>
            )}

            {preview.pessoas.length > 0 && (
              <div className="mt-4 max-h-[28rem] overflow-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Nome</th>
                      <th>TipoPessoa</th>
                      <th>Regional</th>
                      <th>Operadoras/Clientes</th>
                      <th>Empresa</th>
                      <th>Cargo</th>
                      <th>Telefone</th>
                      <th>Status</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.pessoas.map((p) => (
                      <LinhaColaborador key={p.linha} pessoa={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card animate-slide-up">
            <h2 className="mb-4 text-base font-semibold text-white">3. Processar e sincronizar</h2>
            <p className="mb-4 text-sm text-graphite-400">
              Colaboradores ausentes desta planilha e que hoje estão ativos serão marcados como <strong className="text-graphite-200">inativos</strong> (nunca excluídos), preservando todo o histórico.
            </p>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={preview.pessoas.length === 0 || sincronizando}
              className="btn-primary"
            >
              {sincronizando ? "Sincronizando..." : "Confirmar sincronização"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResumoItem({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border border-graphite-700 bg-graphite-900/40 px-3 py-2.5 text-center">
      <p className="text-xl font-semibold tabular-nums text-white">{valor}</p>
      <p className="text-xs text-graphite-500">{label}</p>
    </div>
  );
}

function LinhaColaborador({ pessoa }: { pessoa: ColaboradorImportado }) {
  const observacoes = [...pessoa.erros, ...pessoa.avisos];
  return (
    <tr>
      <td className="tabular-nums text-graphite-500">{pessoa.linha}</td>
      <td className="font-medium text-white">{pessoa.nome || "—"}</td>
      <td>{pessoa.tipoPessoa || "—"}</td>
      <td>{pessoa.regional || "—"}</td>
      <td className="text-xs">{pessoa.operadoras || "—"}</td>
      <td>{pessoa.empresaNome || "—"}</td>
      <td>{pessoa.cargo || "—"}</td>
      <td>{pessoa.telefone || "—"}</td>
      <td>
        {pessoa.status && <span className={`badge ${badgeStatus[pessoa.status]}`}>{rotuloStatus[pessoa.status]}</span>}
      </td>
      <td className="max-w-xs">
        {observacoes.length === 0 ? (
          <span className="text-xs text-graphite-600">—</span>
        ) : (
          <ul className="space-y-0.5">
            {pessoa.erros.map((e, i) => (
              <li key={`e${i}`} className="text-xs text-red-400">{e}</li>
            ))}
            {pessoa.avisos.map((a, i) => (
              <li key={`a${i}`} className="text-xs text-amber-400">{a}</li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}
