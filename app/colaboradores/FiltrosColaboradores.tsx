"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Opcoes = {
  tiposPessoa: string[];
  regionais: string[];
  empresas: string[];
  cargos: string[];
};

/**
 * Barra de filtros do Cadastro Mestre de Colaboradores. A busca por texto
 * (nome/operadoras/telefone) é "instantânea": dispara automaticamente 350ms
 * depois que o usuário para de digitar, sem precisar clicar em um botão.
 * Os demais filtros (selects) aplicam assim que o usuário escolhe uma opção.
 * Tudo é feito via querystring (server-driven), sem estado de dados no
 * cliente — mantém a mesma arquitetura simples usada no resto do sistema.
 */
export default function FiltrosColaboradores({ opcoes }: { opcoes: Opcoes }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get("q") ?? "");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function irPara(params: Record<string, string>) {
    const novo = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(params)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    novo.delete("page"); // qualquer mudança de filtro volta para a primeira página
    router.push(`/colaboradores?${novo.toString()}`);
  }

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (busca !== (searchParams.get("q") ?? "")) irPara({ q: busca });
    }, 350);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <div className="card">
      <h2 className="mb-4 text-base font-semibold text-white">Pesquisa instantânea e filtros</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label-field">Buscar (nome, operadoras ou telefone)</label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-field"
            placeholder="Digite para buscar..."
          />
        </div>
        <div>
          <label className="label-field">TipoPessoa</label>
          <select
            className="input-field"
            defaultValue={searchParams.get("tipoPessoa") ?? ""}
            onChange={(e) => irPara({ tipoPessoa: e.target.value })}
          >
            <option value="">Todos</option>
            {opcoes.tiposPessoa.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Status</label>
          <select
            className="input-field"
            defaultValue={searchParams.get("status") ?? ""}
            onChange={(e) => irPara({ status: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div>
          <label className="label-field">Regional</label>
          <select
            className="input-field"
            defaultValue={searchParams.get("regional") ?? ""}
            onChange={(e) => irPara({ regional: e.target.value })}
          >
            <option value="">Todas</option>
            {opcoes.regionais.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Empresa</label>
          <select
            className="input-field"
            defaultValue={searchParams.get("empresa") ?? ""}
            onChange={(e) => irPara({ empresa: e.target.value })}
          >
            <option value="">Todas</option>
            {opcoes.empresas.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Cargo</label>
          <select
            className="input-field"
            defaultValue={searchParams.get("cargo") ?? ""}
            onChange={(e) => irPara({ cargo: e.target.value })}
          >
            <option value="">Todos</option>
            {opcoes.cargos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setBusca("");
              router.push("/colaboradores");
            }}
            className="btn-secondary w-full"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
