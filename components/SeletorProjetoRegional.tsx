"use client";

import { useState } from "react";
import { listarProjetos, listarRegionaisDoProjeto, regionalAposTrocarProjeto } from "@/lib/projetoRegional";

/**
 * Seletor Projeto × Regional (missão "TELEQUIPE SUPORTE STA — Evolução
 * 7.1"), com 2 `<select>` dependentes. Usado tanto no formulário de novo
 * atendimento quanto no de edição — mesmo componente, mesma fonte única de
 * dados (`lib/projetoRegional.ts`), para nunca duplicar a matriz em vários
 * lugares (regra explícita da missão).
 *
 * IMPORTANTE: este campo `name="projeto"` REUTILIZA a mesma coluna de texto
 * livre "Projeto" que já existia (nome de projeto do cliente) — a partir
 * desta missão, o cadastro/edição passa a restringir os valores aceitos aos
 * 7 Projetos oficiais via este `<select>`, em vez de um `<input>` de texto
 * livre. Isso é INDEPENDENTE do `<select name="categoria_projeto">` de
 * `SeletorCategoriaSuporte.tsx` (Projeto por Fabricante — IEZ/ERICSSON/
 * HUAWEI/NOKIA/ZTE — que governa a hierarquia de Categoria e não foi
 * alterado por esta missão).
 *
 * Regras de cascata (idênticas às exigidas pela missão):
 * - Regional começa desabilitada até um Projeto ser escolhido, e lista só as
 *   Regionais permitidas para aquele Projeto.
 * - Trocar o Projeto verifica se a Regional atualmente selecionada continua
 *   válida para o novo Projeto; se não estiver, ela é limpa (nunca mantém
 *   uma combinação incompatível).
 * - Quando o Projeto escolhido possui exatamente 1 Regional permitida (ex.:
 *   HUAWEI-TIM → BASE, IEZ-ZTE → MG), ela é selecionada automaticamente —
 *   sem impedir que o usuário troque depois, caso o Projeto seja alterado
 *   novamente para um com mais opções.
 * - Mensagem de orientação exibida enquanto nenhum Projeto está selecionado.
 *
 * Modo filtro (`modoFiltro=true`): rótulos das opções vazias viram
 * "Todos"/"Todas" em vez de "Selecione" (mesma convenção de
 * `SeletorCategoriaSuporte.tsx`). Não usado nesta entrega (nenhum novo
 * filtro foi adicionado ao Dashboard/`/suporte` — ver relatório final), mas
 * o componente já nasce preparado para isso, sem duplicar a matriz.
 *
 * MISSÃO "Unificação visual Projeto/Regional no bloco Categoria do
 * atendimento": os dois `<div>` abaixo recebem `lg:col-span-3`/
 * `lg:col-span-2` porque este componente, a partir desta missão, é
 * renderizado exclusivamente dentro de um grid de 5 colunas
 * (`sm:grid-cols-2 lg:grid-cols-5`) no topo do bloco "Categoria do
 * atendimento" de `app/suporte/novo/page.tsx` e `app/suporte/[id]/page.tsx`
 * — os únicos dois lugares que usam este componente. Não há mais nenhum uso
 * deste componente na linha de topo do formulário (Colaborador/Cliente/
 * Site).
 */
export default function SeletorProjetoRegional({
  projetoDefault = "",
  regionalDefault = "",
  modoFiltro = false,
  obrigatorio = false,
}: {
  projetoDefault?: string;
  regionalDefault?: string;
  modoFiltro?: boolean;
  obrigatorio?: boolean;
}) {
  const [projeto, setProjeto] = useState(projetoDefault);
  const [regional, setRegional] = useState(() => regionalAposTrocarProjeto(projetoDefault, regionalDefault));

  const projetos = listarProjetos();
  const regionaisPermitidas = listarRegionaisDoProjeto(projeto);

  function selecionarProjeto(novoProjeto: string) {
    setProjeto(novoProjeto);
    // Regra de cascata centralizada em lib/projetoRegional.ts
    // (`regionalAposTrocarProjeto`) — fonte única, testável sem depender de
    // DOM/eventos de clique (ver tests/projetoRegional.test.ts).
    setRegional((regionalAtual) => regionalAposTrocarProjeto(novoProjeto, regionalAtual));
  }

  const rotuloVazioProjeto = modoFiltro ? "Todos" : "Selecione";
  const rotuloVazioRegional = !projeto ? "Selecione o projeto primeiro" : modoFiltro ? "Todas" : "Selecione";

  return (
    <>
      <div className="lg:col-span-3">
        <label htmlFor="projeto-oficial" className="label-field">Projeto</label>
        <select
          id="projeto-oficial"
          name="projeto"
          required={obrigatorio}
          className="input-field"
          value={projeto}
          onChange={(e) => selecionarProjeto(e.target.value)}
        >
          <option value="">{rotuloVazioProjeto}</option>
          {projetos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="lg:col-span-2">
        <label htmlFor="regional-oficial" className="label-field">Regional</label>
        <select
          id="regional-oficial"
          name="regional"
          required={obrigatorio && regionaisPermitidas.length > 0}
          className="input-field"
          value={regional}
          disabled={!projeto || regionaisPermitidas.length === 0}
          aria-describedby={!projeto ? "regional-orientacao" : undefined}
          onChange={(e) => setRegional(e.target.value)}
        >
          <option value="">{rotuloVazioRegional}</option>
          {regionaisPermitidas.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {!projeto && (
          <p id="regional-orientacao" className="mt-1 text-xs text-graphite-500">
            Selecione primeiro o projeto para visualizar as regionais disponíveis.
          </p>
        )}
      </div>
    </>
  );
}
