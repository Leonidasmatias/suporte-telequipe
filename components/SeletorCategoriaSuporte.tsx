"use client";

import { useState } from "react";
import {
  obterProjetos,
  obterCategoriasPrincipais,
  obterSubcategorias,
  obterDetalhamentos,
} from "@/lib/categoriasSuporte";

/**
 * Seletor hierárquico de Categoria de Suporte (Projeto → Categoria Principal
 * → Subcategoria → Detalhamento), com 4 `<select>` dependentes. Usado tanto
 * no formulário de novo atendimento/edição quanto no painel de filtros da
 * listagem (`modoFiltro`) — mesmo componente, mesma fonte única de dados
 * (`lib/categoriasSuporte.ts`), para nunca duplicar a lista em vários lugares.
 *
 * MISSÃO v7.1 (revisão da matriz hierárquica): o nível "Projeto" aqui
 * (IEZ/ERICSSON/HUAWEI/NOKIA/ZTE) é um conceito NOVO e completamente
 * diferente do campo de texto livre "Projeto" já existente em outras partes
 * do mesmo formulário (nome de projeto do cliente, ex.: "Expansão 5G Regional
 * Sul") — por isso o `<select>` deste nível usa o nome de campo
 * `categoria_projeto` (nunca `projeto`), evitando qualquer colisão com aquele
 * outro campo quando os dois aparecem no mesmo `<form>`.
 *
 * Regras de cascata:
 * - Categoria Principal começa desabilitada até um Projeto ser escolhido, e
 *   lista só as categorias daquele Projeto. Desde a correção "IEZ deve
 *   replicar os demais projetos", os 5 Projetos (ERICSSON/HUAWEI/NOKIA/ZTE/
 *   IEZ) compartilham exatamente a mesma lista de Categorias Principais
 *   (MOS, Infraestrutura, Instalação, Ativação, Aceitação) — nenhum Projeto
 *   tem categoria exclusiva.
 * - Subcategoria começa desabilitada até uma Categoria Principal ser
 *   escolhida.
 * - Detalhamento começa desabilitado até uma Subcategoria com detalhamentos
 *   ser escolhida.
 * - Trocar o Projeto limpa Categoria Principal, Subcategoria e Detalhamento.
 *   Trocar a Categoria Principal limpa Subcategoria e Detalhamento. Trocar a
 *   Subcategoria limpa o Detalhamento. Nunca é possível ver opções fora da
 *   seleção do nível pai (as listas vêm sempre filtradas de
 *   `obterCategoriasPrincipais`/`obterSubcategorias`/`obterDetalhamentos`).
 *
 * Modo criação (`obrigatorio=true`): Projeto e Categoria Principal são
 * obrigatórios.
 * Modo edição (`obrigatorio=false`, o padrão): todos os 4 níveis podem ficar
 * em branco — usado para permitir que um atendimento com apenas o campo
 * legado `categoria` seja salvo sem alterar a classificação ("Não substituir
 * a categoria legada a menos que o usuário selecione uma nova classificação
 * hierárquica e salve", ver app/suporte/actions.ts).
 * Modo filtro (`modoFiltro=true`): rótulos das opções vazias viram
 * "Todas"/"Todos" em vez de "Selecione".
 */
export default function SeletorCategoriaSuporte({
  obrigatorio = false,
  modoFiltro = false,
  projetoDefault = "",
  categoriaPrincipalDefault = "",
  subcategoriaDefault = "",
  detalhamentoDefault = "",
  className = "",
}: {
  obrigatorio?: boolean;
  modoFiltro?: boolean;
  projetoDefault?: string;
  categoriaPrincipalDefault?: string;
  subcategoriaDefault?: string;
  detalhamentoDefault?: string;
  className?: string;
}) {
  const [projeto, setProjeto] = useState(projetoDefault);
  const [categoriaPrincipal, setCategoriaPrincipal] = useState(categoriaPrincipalDefault);
  const [subcategoria, setSubcategoria] = useState(subcategoriaDefault);
  const [detalhamento, setDetalhamento] = useState(detalhamentoDefault);

  const projetos = obterProjetos();
  const categoriasPrincipais = obterCategoriasPrincipais(projeto);
  const subcategorias = obterSubcategorias(projeto, categoriaPrincipal);
  const detalhamentos = obterDetalhamentos(projeto, categoriaPrincipal, subcategoria);

  const rotuloVazioProjeto = modoFiltro ? "Todos" : obrigatorio ? "Selecione" : "Não alterar / categoria legada";
  const rotuloVazioPrincipal = modoFiltro ? "Todas" : !projeto ? "Selecione o Projeto primeiro" : "Selecione";
  const rotuloVazioSub = modoFiltro ? "Todas" : subcategorias.length === 0 ? "Não se aplica" : "Selecione";
  const rotuloVazioDet = modoFiltro ? "Todos" : detalhamentos.length === 0 ? "Não se aplica" : "Selecione";

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      <div>
        <label className="label-field">Projeto</label>
        <select
          name="categoria_projeto"
          required={obrigatorio}
          className="input-field"
          value={projeto}
          onChange={(e) => {
            setProjeto(e.target.value);
            setCategoriaPrincipal("");
            setSubcategoria("");
            setDetalhamento("");
          }}
        >
          <option value="">{rotuloVazioProjeto}</option>
          {projetos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-field">Categoria Principal</label>
        <select
          name="categoria_principal"
          required={obrigatorio}
          className="input-field"
          value={categoriaPrincipal}
          disabled={!projeto || categoriasPrincipais.length === 0}
          onChange={(e) => {
            setCategoriaPrincipal(e.target.value);
            setSubcategoria("");
            setDetalhamento("");
          }}
        >
          <option value="">{rotuloVazioPrincipal}</option>
          {categoriasPrincipais.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-field">Subcategoria</label>
        <select
          name="subcategoria"
          className="input-field"
          value={subcategoria}
          disabled={!categoriaPrincipal || subcategorias.length === 0}
          onChange={(e) => {
            setSubcategoria(e.target.value);
            setDetalhamento("");
          }}
        >
          <option value="">{rotuloVazioSub}</option>
          {subcategorias.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-field">Detalhamento</label>
        <select
          name="detalhamento"
          className="input-field"
          value={detalhamento}
          disabled={!subcategoria || detalhamentos.length === 0}
          onChange={(e) => setDetalhamento(e.target.value)}
        >
          <option value="">{rotuloVazioDet}</option>
          {detalhamentos.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
