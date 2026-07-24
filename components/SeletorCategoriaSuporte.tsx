"use client";

import { useState } from "react";
import {
  obterCategoriasPrincipais,
  obterSubcategorias,
  obterDetalhamentos,
} from "@/lib/categoriasSuporte";

/**
 * Seletor hierárquico de Categoria de Suporte (Categoria Principal →
 * Subcategoria → Detalhamento), com 3 `<select>` dependentes. Usado tanto
 * no formulário de novo atendimento/edição quanto no painel de filtros da
 * listagem (`modoFiltro`) — mesmo componente, mesma fonte única de dados
 * (`lib/categoriasSuporte.ts`), para nunca duplicar a lista em vários lugares.
 *
 * MISSÃO "Refatoração da Categoria do Atendimento — eliminação do campo
 * Projeto duplicado" (v7.3): o nível "Projeto" (antes IEZ/ERICSSON/HUAWEI/
 * NOKIA/ZTE, campo `categoria_projeto`) foi REMOVIDO deste componente —
 * decisão explícita do usuário para que exista um único campo "Projeto" no
 * sistema (a matriz oficial Projeto × Regional, ver
 * `components/SeletorProjetoRegional.tsx`/`lib/projetoRegional.ts`). Este
 * componente não lê nem grava mais nenhum campo chamado "Projeto" — o
 * usuário não vê, não edita e não seleciona mais o antigo "Projeto por
 * Fabricante"; ele deixou de existir na hierarquia de categorias.
 *
 * Regras de cascata:
 * - Subcategoria começa desabilitada até uma Categoria Principal ser
 *   escolhida, e lista só as subcategorias daquela Categoria Principal.
 * - Detalhamento começa desabilitado até uma Subcategoria com detalhamentos
 *   ser escolhida — nem toda Subcategoria tem Detalhamento (a maioria não
 *   tem mais, desde a revisão desta missão), caso em que o campo fica
 *   desabilitado com "Não se aplica".
 * - Trocar a Categoria Principal limpa Subcategoria e Detalhamento. Trocar a
 *   Subcategoria limpa o Detalhamento. Nunca é possível ver opções fora da
 *   seleção do nível pai (as listas vêm sempre filtradas de
 *   `obterSubcategorias`/`obterDetalhamentos`).
 *
 * Modo criação (`obrigatorio=true`): Categoria Principal é obrigatória.
 * Modo edição (`obrigatorio=false`, o padrão): os 3 níveis podem ficar em
 * branco — usado para permitir que um atendimento com apenas o campo
 * legado `categoria` seja salvo sem alterar a classificação ("Não substituir
 * a categoria legada a menos que o usuário selecione uma nova classificação
 * hierárquica e salve", ver app/suporte/actions.ts).
 * Modo filtro (`modoFiltro=true`): rótulos das opções vazias viram
 * "Todas"/"Todos" em vez de "Selecione".
 */
export default function SeletorCategoriaSuporte({
  obrigatorio = false,
  modoFiltro = false,
  categoriaPrincipalDefault = "",
  subcategoriaDefault = "",
  detalhamentoDefault = "",
  className = "",
}: {
  obrigatorio?: boolean;
  modoFiltro?: boolean;
  categoriaPrincipalDefault?: string;
  subcategoriaDefault?: string;
  detalhamentoDefault?: string;
  className?: string;
}) {
  const [categoriaPrincipal, setCategoriaPrincipal] = useState(categoriaPrincipalDefault);
  const [subcategoria, setSubcategoria] = useState(subcategoriaDefault);
  const [detalhamento, setDetalhamento] = useState(detalhamentoDefault);

  const categoriasPrincipais = obterCategoriasPrincipais();
  const subcategorias = obterSubcategorias(categoriaPrincipal);
  const detalhamentos = obterDetalhamentos(categoriaPrincipal, subcategoria);

  const rotuloVazioPrincipal = modoFiltro ? "Todas" : obrigatorio ? "Selecione" : "Não alterar / categoria legada";
  const rotuloVazioSub = modoFiltro ? "Todas" : !categoriaPrincipal ? "Selecione a Categoria Principal primeiro" : subcategorias.length === 0 ? "Não se aplica" : "Selecione";
  const rotuloVazioDet = modoFiltro ? "Todos" : detalhamentos.length === 0 ? "Não se aplica" : "Selecione";

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      <div>
        <label className="label-field">Categoria Principal</label>
        <select
          name="categoria_principal"
          required={obrigatorio}
          className="input-field"
          value={categoriaPrincipal}
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
