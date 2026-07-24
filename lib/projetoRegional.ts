/**
 * Fonte única da relação oficial Projeto × Regional (missão "TELEQUIPE
 * SUPORTE STA — Evolução 7.1"). Nenhum outro arquivo deve duplicar esta
 * matriz — formulário de cadastro/edição de atendimento, validação de
 * backend e o novo gráfico "Chamados por Projeto e Regional" do Dashboard
 * Executivo importam tudo daqui (direta ou indiretamente).
 *
 * IMPORTANTE — este "Projeto" é um conceito NOVO e completamente distinto de
 * dois outros campos que já existiam no sistema antes desta missão, para
 * nunca serem confundidos:
 *
 *  1. `SupportTicket.projeto` (coluna de texto livre já existente, "nome de
 *     projeto do cliente", ex.: "Expansão 5G Regional Sul") — esta missão
 *     passa a REUTILIZAR esta mesma coluna (nenhuma coluna nova para
 *     "Projeto" foi criada), restringindo, a partir de agora, os valores
 *     aceitos no cadastro/edição aos 7 nomes oficiais abaixo (antes era
 *     texto livre sem nenhuma validação). Atendimentos antigos com texto
 *     livre fora desta lista NÃO são alterados nem migrados — continuam
 *     visíveis e são tratados como "Projeto não classificado" (ver
 *     `classificarProjetoRegionalHistorico` abaixo e lib/dashboardSuporte.ts).
 *
 *  2. O nível "Projeto" da hierarquia de Categoria (IEZ/ERICSSON/HUAWEI/
 *     NOKIA/ZTE — campo de formulário `categoria_projeto`, lib/categoriasSuporte.ts,
 *     que governa Categoria Principal → Subcategoria → Detalhamento) é um
 *     Projeto por FABRICANTE apenas, e continua 100% intacto — esta missão
 *     não o modifica, não o remove e não reaproveita nenhuma parte dele. A
 *     matriz abaixo é por Fabricante + Operadora/Cliente (ex.: "NOKIA-TIM" e
 *     "NOKIA-CLARO" são dois Projetos distintos aqui, mas ambos usariam o
 *     mesmo "NOKIA" na hierarquia de Categoria, que não muda em nada).
 *
 *  3. Também existe um "Regional" de texto livre em Colaborador
 *     (lib/colaboradores.ts, já usado no filtro "Regional" e no gráfico
 *     "Chamados por Regional" do Dashboard Executivo) — é o Regional do
 *     FUNCIONÁRIO, sem relação com Projeto e sem lista oficial. O Regional
 *     desta matriz é um conceito novo e independente: pertence ao CHAMADO em
 *     si (nova coluna `SupportTicket.regional`), validado contra o Projeto
 *     do próprio chamado. Os dois "Regional" coexistem sem se misturar; o
 *     novo gráfico "Chamados por Projeto e Regional" usa exclusivamente o
 *     Regional do chamado, nunca o do Colaborador.
 *
 * Não existe nenhuma migração destrutiva: a coluna `regional` (nova, ver
 * migration 20260724120000_add_regional_suporte) é aditiva e nullable —
 * atendimentos antigos ficam com `regional` NULL e continuam aparecendo
 * normalmente.
 *
 * Este módulo não importa nada do Prisma nem do Next — é puro TypeScript,
 * seguro para uso tanto em Server Components/Actions quanto em Client
 * Components (mesmo padrão já usado por `lib/categoriasSuporte.ts`/
 * `lib/permissoes.ts`).
 */

export const PROJETO_REGIONAIS = {
  "ERICSSON-CLARO": ["SM", "SI"],
  "VIVO SIRIUS-ERICSSON": ["SP", "MG", "BASE"],
  "NOKIA-TIM": ["SP", "MG", "CO"],
  "NOKIA-CLARO": ["BASE", "NO"],
  "HUAWEI-TIM": ["BASE"],
  "ZTE-CLARO": ["NO", "RJ", "SP", "MG"],
  "IEZ-ZTE": ["MG"],
} as const;

export type ProjetoOficial = keyof typeof PROJETO_REGIONAIS;

/** Buckets de exibição para dados fora da matriz oficial (histórico/legado) — usados pelo Dashboard Executivo. */
export const PROJETO_NAO_CLASSIFICADO = "Projeto não classificado";
export const REGIONAL_NAO_CLASSIFICADA = "Regional não classificada";
export const COMBINACAO_HISTORICA = "Combinação histórica";

const PROJETOS_OFICIAIS = Object.keys(PROJETO_REGIONAIS) as ProjetoOficial[];

function normalizarChave(valor: string): string {
  return valor.trim().toUpperCase().replace(/\s+/g, " ");
}

// Mapa auxiliar para normalização (comparação sem diferenciar
// maiúsculas/minúsculas nem espaçamento nas bordas) — os valores CANÔNICOS
// devolvidos e exibidos na interface são sempre os literais definidos acima
// em `PROJETO_REGIONAIS`, nunca uma variação de grafia.
const PROJETOS_POR_CHAVE_NORMALIZADA = new Map<string, ProjetoOficial>(
  PROJETOS_OFICIAIS.map((p) => [normalizarChave(p), p])
);

/** Lista os 7 Projetos oficiais, na ordem definida na matriz. */
export function listarProjetos(): ProjetoOficial[] {
  return [...PROJETOS_OFICIAIS];
}

/** Lista as Regionais permitidas para um Projeto oficial. Projeto vazio/nulo ou desconhecido → lista vazia. */
export function listarRegionaisDoProjeto(projeto: string | null | undefined): string[] {
  const oficial = normalizarProjeto(projeto);
  if (!oficial) return [];
  return [...PROJETO_REGIONAIS[oficial]];
}

/** Confirma se `regional` é uma das Regionais permitidas para `projeto` (ambos normalizados antes da comparação). */
export function projetoAceitaRegional(
  projeto: string | null | undefined,
  regional: string | null | undefined
): boolean {
  const oficial = normalizarProjeto(projeto);
  const regionalNormalizada = normalizarRegional(regional);
  if (!oficial || !regionalNormalizada) return false;
  return (PROJETO_REGIONAIS[oficial] as readonly string[]).includes(regionalNormalizada);
}

/**
 * Normaliza um valor de Projeto contra a matriz oficial: tolera variação de
 * caixa/espaçamento nas bordas na COMPARAÇÃO, mas sempre devolve o valor
 * CANÔNICO exato definido em `PROJETO_REGIONAIS` (nunca uma variação).
 * Devolve `null` para vazio ou para qualquer valor que não seja um dos 7
 * Projetos oficiais (isso inclui texto livre legado de "nome de projeto do
 * cliente" — tratado como "Projeto não classificado" por quem chama esta
 * função, nunca um erro).
 */
export function normalizarProjeto(valor: string | null | undefined): ProjetoOficial | null {
  if (!valor) return null;
  return PROJETOS_POR_CHAVE_NORMALIZADA.get(normalizarChave(valor)) ?? null;
}

/**
 * Normaliza um valor de Regional (trim + maiúsculas — todos os códigos
 * oficiais de Regional desta matriz são maiúsculos: SM, SI, SP, MG, BASE,
 * CO, NO, RJ). NÃO valida contra nenhum Projeto específico — apenas
 * normalização sintática; use `projetoAceitaRegional` para validar a
 * combinação. Devolve `null` para vazio.
 */
export function normalizarRegional(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.trim().toUpperCase();
  return limpo || null;
}

/**
 * Decide qual deve ser o valor de Regional depois que o usuário troca o
 * Projeto selecionado no formulário (`SeletorProjetoRegional.tsx`) — extraída
 * como função pura e testável (este projeto não usa jsdom/Testing Library,
 * ver convenção já estabelecida em outros testes), para que a regra de
 * cascata em si seja verificável sem precisar simular DOM/eventos de clique.
 *
 * Regras (idênticas às exigidas pela missão, seção "Comportamento dos campos
 * Projeto e Regional"):
 *  - Novo Projeto com exatamente 1 Regional permitida: pré-seleciona
 *    automaticamente essa Regional.
 *  - Regional atualmente selecionada continua permitida para o novo Projeto:
 *    mantém.
 *  - Caso contrário (Regional deixou de ser válida, ou nenhum Projeto foi
 *    escolhido): limpa — nunca mantém uma combinação incompatível.
 */
export function regionalAposTrocarProjeto(novoProjeto: string, regionalAtual: string): string {
  const permitidas = listarRegionaisDoProjeto(novoProjeto);
  if (permitidas.length === 1) return permitidas[0];
  if (regionalAtual && permitidas.includes(regionalAtual)) return regionalAtual;
  return "";
}

export type ResultadoValidacaoProjetoRegional = { valido: true } | { valido: false; erro: string };

/**
 * Validação completa da combinação Projeto/Regional — usada tanto pelo
 * formulário (`SeletorProjetoRegional`, via cascata no cliente) quanto, de
 * forma OBRIGATÓRIA e independente, pelo backend em `app/suporte/actions.ts`
 * ("a restrição não pode existir somente no formulário").
 *
 * Regras, em ordem:
 *  1. Projeto e Regional em branco: válido. Nenhuma obrigatoriedade nova é
 *     imposta — os dois campos continuam opcionais, exatamente como
 *     `projeto` já era antes desta missão.
 *  2. Regional preenchida sem Projeto: inválido (não é possível saber se a
 *     Regional é permitida sem saber o Projeto).
 *  3. Projeto preenchido mas fora da matriz oficial: inválido. O formulário
 *     novo só envia um dos 7 Projetos oficiais (via `<select>`) — um valor
 *     fora da lista aqui só pode vir de uma chamada direta à API tentando
 *     contornar a regra da interface, ou de um valor de texto livre legado
 *     sendo reenviado sem passar pelo novo seletor.
 *  4. Projeto oficial + Regional fora da lista permitida para aquele
 *     Projeto: inválido, com a mensagem exata exigida pela missão.
 */
export function validarProjetoRegional(
  projeto: string | null | undefined,
  regional: string | null | undefined
): ResultadoValidacaoProjetoRegional {
  const projetoBruto = projeto?.trim() || null;
  const regionalBruta = regional?.trim() || null;

  if (!projetoBruto && !regionalBruta) return { valido: true };

  if (!projetoBruto && regionalBruta) {
    return { valido: false, erro: "Selecione um projeto antes de informar a regional." };
  }

  const projetoOficial = normalizarProjeto(projetoBruto);
  if (!projetoOficial) {
    return { valido: false, erro: `"${projetoBruto}" não é um projeto oficial válido.` };
  }

  if (!regionalBruta) return { valido: true };

  if (!projetoAceitaRegional(projetoOficial, regionalBruta)) {
    return {
      valido: false,
      erro: `A regional ${normalizarRegional(regionalBruta)} não está disponível para o projeto ${projetoOficial}.`,
    };
  }

  return { valido: true };
}

/**
 * Classifica um par (projeto, regional) já persistido para fins de exibição
 * agregada (Dashboard Executivo) — NUNCA lança erro e sempre devolve uma
 * classificação, mesmo para dados históricos/legados fora da matriz atual
 * (regra explícita da missão: "não excluir nem alterar automaticamente
 * chamados antigos"; "registros históricos... devem continuar visíveis").
 */
export function classificarProjetoRegionalHistorico(
  projeto: string | null | undefined,
  regional: string | null | undefined
): { projeto: string; regional: string } {
  const projetoOficial = normalizarProjeto(projeto);
  const regionalNormalizada = normalizarRegional(regional);

  if (!projetoOficial) {
    // Projeto ausente ou fora da matriz oficial (texto livre legado, nome de
    // projeto de cliente, etc.) — agrupado inteiramente como "Projeto não
    // classificado", independentemente do valor de Regional.
    return { projeto: PROJETO_NAO_CLASSIFICADO, regional: regionalNormalizada ?? REGIONAL_NAO_CLASSIFICADA };
  }

  if (!regionalNormalizada) {
    return { projeto: projetoOficial, regional: REGIONAL_NAO_CLASSIFICADA };
  }

  if (!projetoAceitaRegional(projetoOficial, regionalNormalizada)) {
    // Projeto válido, mas combinação fora da matriz ATUAL — o dado nunca é
    // descartado, apenas classificado como "Combinação histórica" (ex.: uma
    // combinação registrada sob uma versão anterior da matriz oficial).
    return { projeto: projetoOficial, regional: COMBINACAO_HISTORICA };
  }

  return { projeto: projetoOficial, regional: regionalNormalizada };
}
