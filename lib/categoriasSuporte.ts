/**
 * Fonte única da classificação hierárquica de atendimentos da Central de
 * Suporte Técnico. Nenhum outro arquivo deve duplicar esta lista —
 * formulário de criação, edição, listagem, filtros, exportação e relatórios
 * importam tudo daqui (direta ou indiretamente, via `obterRotuloCategoriaExibicao`/
 * `formatarCategoriaHierarquica`/`obterClassificacaoAtualValida`).
 *
 * MISSÃO "TELEQUIPE SUPORTE STA v7.1 — Revisão da Matriz Hierárquica": esta é
 * a nova arquitetura OFICIAL, que substitui COMPLETAMENTE a matriz anterior
 * (3 níveis: Categoria Principal → Subcategoria → Detalhamento, sem conceito
 * de Projeto). A matriz anterior foi inteiramente descartada — nenhuma
 * função, tipo ou dado dela permanece neste arquivo.
 *
 * MISSÃO "TELEQUIPE SUPORTE STA v7.1 — Correção da Matriz — IEZ deve
 * replicar os demais projetos": a primeira versão desta revisão tinha dado
 * ao Projeto "IEZ" uma estrutura EXCLUSIVA ("Dia de Integração" com 7
 * subcategorias próprias) — essa estrutura exclusiva foi COMPLETAMENTE
 * DESCARTADA. Os 5 projetos (ERICSSON, HUAWEI, NOKIA, ZTE, IEZ) agora
 * compartilham EXATAMENTE a mesma matriz operacional de Categorias
 * Principais/Subcategorias/Detalhamentos — nenhum deles tem conteúdo
 * exclusivo. "IEZ" continua sendo uma opção independente no seletor de
 * Projeto (o nível "Projeto" continua existindo e sendo o topo da
 * hierarquia); a única mudança é que ele agora aponta para a MESMA
 * referência de categorias que os outros 4, em vez de ter a sua própria.
 *
 * NOVA HIERARQUIA (4 níveis): Projeto → Categoria Principal → Subcategoria →
 * Detalhamento.
 *  - Os 5 Projetos (ERICSSON, HUAWEI, NOKIA, ZTE, IEZ) compartilham
 *    EXATAMENTE a mesma estrutura de Categorias Principais (MOS,
 *    Infraestrutura, Instalação, Ativação, Aceitação) — centralizada em
 *    `CATEGORIAS_PROJETO_DE_CAMPO` abaixo (todos os 5 apontam para a MESMA
 *    referência de array, nunca uma cópia) para nunca duplicar a matriz 5
 *    vezes e facilitar a inclusão de novos projetos/categorias no futuro.
 *
 * PERSISTÊNCIA SEM ALTERAR O SCHEMA (regra explícita da missão: "Não criar
 * migrations. Não alterar Prisma/Schema. Reutilizar a estrutura já
 * existente"): a tabela `SupportTicket` só tem 3 colunas estruturadas
 * (`categoriaPrincipal`, `subcategoria`, `detalhamento`) — não existe uma
 * coluna dedicada para o novo nível "Projeto". Por isso o Projeto é
 * codificado DENTRO da própria coluna `categoriaPrincipal`, usando o mesmo
 * separador " > " já usado em todo o sistema para juntar níveis da
 * hierarquia:
 *  - `null`                          → nenhuma classificação nova escolhida.
 *  - "IEZ"                           → só o Projeto foi escolhido (Categoria
 *                                      Principal ainda vazia).
 *  - "NOKIA > MOS"                   → Projeto + Categoria Principal.
 * `subcategoria`/`detalhamento` continuam colunas simples (bare strings),
 * sem nenhuma mudança de formato. `combinarProjetoCategoria` (escrita) e
 * `interpretarCategoriaPrincipalPersistida` (leitura) isolam completamente
 * essa codificação — nenhum outro arquivo do sistema precisa conhecer o
 * truque: todos consomem `ClassificacaoSuporte` (objeto lógico de 4 campos)
 * através das funções públicas deste módulo.
 *
 * COMPATIBILIDADE COM ATENDIMENTOS ANTIGOS (regra explícita da missão:
 * "Os atendimentos antigos NÃO podem ser alterados. Não migrar registros.").
 * `interpretarCategoriaPrincipalPersistida` só reconhece valores que casam
 * EXATAMENTE com a matriz atual (um Projeto válido, sozinho ou seguido de
 * " > " + uma Categoria Principal que pertença a esse Projeto). Qualquer
 * outra coisa — nunca classificado, categoria "solta" de uma matriz v7.1
 * anterior (ex.: "MOS" sozinho, sem Projeto), um valor da estrutura
 * EXCLUSIVA que o Projeto IEZ chegou a ter na primeira versão desta revisão
 * (ex.: "IEZ > Dia de Integração" — "Dia de Integração" não existe mais como
 * Categoria Principal de nenhum projeto), ou qualquer valor mais antigo ainda
 * (ex.: "3 - ATIVAÇÃO") — devolve `null`, e o restante do sistema trata isso
 * como "categoria legada": exibe o texto já salvo (`categoria`) sem tentar
 * traduzir, migrar ou pré-selecionar nada no seletor novo. Editar um desses
 * atendimentos sem mexer no seletor de categoria preserva o valor legado
 * 100% intacto (ver `updateTicket` em app/suporte/actions.ts).
 *
 * Este módulo não importa nada do Prisma nem do Next — é puro TypeScript,
 * seguro para uso tanto em Server Components/Actions quanto em Client
 * Components (mesmo padrão já usado por `lib/permissoes.ts`).
 */

export type NoSubcategoria = {
  nome: string;
  detalhamentos: string[];
};

export type NoCategoriaPrincipal = {
  nome: string;
  subcategorias: NoSubcategoria[];
};

export type NoProjeto = {
  nome: string;
  categorias: NoCategoriaPrincipal[];
};

const SEPARADOR = " > ";

/**
 * Estrutura de Categorias Principais compartilhada por TODOS os 5 projetos
 * (ERICSSON, HUAWEI, NOKIA, ZTE e, desde a correção desta missão, também
 * IEZ) — 5 categorias: MOS, Infraestrutura, Instalação, Ativação, Aceitação.
 * Única fonte reaproveitada pelos 5 projetos (nunca copiada) — para incluir
 * um projeto novo que utilize esta mesma matriz operacional, basta apontar
 * `categorias` para esta constante em `MATRIZ_CLASSIFICACAO_SUPORTE` abaixo;
 * nenhuma duplicação de conteúdo é necessária.
 */
const CATEGORIAS_PROJETO_DE_CAMPO: NoCategoriaPrincipal[] = [
  {
    nome: "MOS",
    subcategorias: [
      { nome: "Log de Antes", detalhamentos: ["Geral"] },
      { nome: "EHS", detalhamentos: ["Aplicativos e Orientações"] },
      { nome: "Logística / Transportadora", detalhamentos: ["Geral"] },
      { nome: "Material", detalhamentos: ["OK", "NOK"] },
      { nome: "Aplicativos", detalhamentos: ["Geral"] },
      { nome: "Orientação", detalhamentos: ["Geral"] },
    ],
  },
  {
    nome: "Infraestrutura",
    subcategorias: [
      { nome: "Energia", detalhamentos: ["Configuração", "Alarmes"] },
      { nome: "TX", detalhamentos: ["TX Operadora NOK", "Alarmes"] },
      { nome: "Fibra Óptica", detalhamentos: ["Alarmes", "FO NOK"] },
      {
        nome: "Sistema Irradiante",
        detalhamentos: ["Suporte", "Falta de Infraestrutura", "Esteiramento Horizontal / Vertical"],
      },
      { nome: "Solo", detalhamentos: ["Gabinete", "Passagem de Cabos / FO"] },
    ],
  },
  {
    nome: "Instalação",
    subcategorias: [
      { nome: "Orientação sobre o Projeto", detalhamentos: ["Geral"] },
      { nome: "Padrão de Instalação", detalhamentos: ["Geral"] },
      { nome: "Hardware", detalhamentos: ["Avarias", "Falhas"] },
      { nome: "Ferramentas", detalhamentos: ["Geral"] },
    ],
  },
  {
    nome: "Ativação",
    subcategorias: [
      { nome: "Configuração", detalhamentos: ["Controladora", "Periféricos", "Energia"] },
      { nome: "Alarmes", detalhamentos: ["Configuração", "Teste Físico"] },
      { nome: "Atualização SW", detalhamentos: ["Geral"] },
      { nome: "Script / XML", detalhamentos: ["Geral"] },
      { nome: "Orientação", detalhamentos: ["Geral"] },
    ],
  },
  {
    nome: "Aceitação",
    subcategorias: [
      { nome: "Teste de Voz / Dados", detalhamentos: ["Ericsson", "Vivo"] },
      { nome: "Alarmes", detalhamentos: ["Retirada"] },
      { nome: "Documentação / Relatório Fotográfico", detalhamentos: ["QC", "RFA"] },
      { nome: "RSA Claro", detalhamentos: ["Agendamento de Vídeo"] },
      { nome: "Log Depois", detalhamentos: ["Geral"] },
    ],
  },
];

/**
 * Matriz completa oficial (Sprint v7.1 — correção): 5 Projetos, todos
 * apontando para a MESMA referência de Categorias Principais/Subcategorias/
 * Detalhamentos (`CATEGORIAS_PROJETO_DE_CAMPO`) — nenhum projeto tem
 * conteúdo exclusivo. Não alterar sem uma nova definição oficial do time —
 * para incluir um novo projeto que reutilize esta matriz, basta adicionar
 * `{ nome: "NOVO_PROJETO", categorias: CATEGORIAS_PROJETO_DE_CAMPO }` aqui;
 * nenhuma outra tela precisa ser tocada (todas consomem só as funções
 * abaixo).
 */
export const MATRIZ_CLASSIFICACAO_SUPORTE: NoProjeto[] = [
  { nome: "ERICSSON", categorias: CATEGORIAS_PROJETO_DE_CAMPO },
  { nome: "HUAWEI", categorias: CATEGORIAS_PROJETO_DE_CAMPO },
  { nome: "NOKIA", categorias: CATEGORIAS_PROJETO_DE_CAMPO },
  { nome: "ZTE", categorias: CATEGORIAS_PROJETO_DE_CAMPO },
  { nome: "IEZ", categorias: CATEGORIAS_PROJETO_DE_CAMPO },
];

function encontrarProjeto(nomeProjeto: string | null | undefined): NoProjeto | undefined {
  if (!nomeProjeto) return undefined;
  return MATRIZ_CLASSIFICACAO_SUPORTE.find((p) => p.nome === nomeProjeto);
}

function encontrarCategoriaPrincipal(
  nomeProjeto: string | null | undefined,
  nomeCategoria: string | null | undefined
): NoCategoriaPrincipal | undefined {
  const projeto = encontrarProjeto(nomeProjeto);
  if (!projeto || !nomeCategoria) return undefined;
  return projeto.categorias.find((c) => c.nome === nomeCategoria);
}

function encontrarSubcategoria(
  nomeProjeto: string | null | undefined,
  nomeCategoria: string | null | undefined,
  nomeSub: string | null | undefined
): NoSubcategoria | undefined {
  const categoria = encontrarCategoriaPrincipal(nomeProjeto, nomeCategoria);
  if (!categoria || !nomeSub) return undefined;
  return categoria.subcategorias.find((s) => s.nome === nomeSub);
}

/** Todos os Projetos, na ordem oficial (ERICSSON, HUAWEI, NOKIA, ZTE, IEZ). */
export function obterProjetos(): string[] {
  return MATRIZ_CLASSIFICACAO_SUPORTE.map((p) => p.nome);
}

/** Categorias Principais do Projeto informado. Lista vazia se o Projeto não existir ou não estiver informado. */
export function obterCategoriasPrincipais(projeto: string | null | undefined): string[] {
  const p = encontrarProjeto(projeto);
  if (!p) return [];
  return p.categorias.map((c) => c.nome);
}

/** Subcategorias da Categoria Principal informada, dentro do Projeto informado. Lista vazia se a combinação não existir. */
export function obterSubcategorias(
  projeto: string | null | undefined,
  categoriaPrincipal: string | null | undefined
): string[] {
  const categoria = encontrarCategoriaPrincipal(projeto, categoriaPrincipal);
  if (!categoria) return [];
  return categoria.subcategorias.map((s) => s.nome);
}

/** Detalhamentos da Subcategoria informada, dentro do Projeto/Categoria Principal informados. Lista vazia se a combinação não existir. */
export function obterDetalhamentos(
  projeto: string | null | undefined,
  categoriaPrincipal: string | null | undefined,
  subcategoria: string | null | undefined
): string[] {
  const sub = encontrarSubcategoria(projeto, categoriaPrincipal, subcategoria);
  if (!sub) return [];
  return sub.detalhamentos.slice();
}

export type ClassificacaoSuporte = {
  projeto?: string | null;
  categoriaPrincipal?: string | null;
  subcategoria?: string | null;
  detalhamento?: string | null;
};

export type ResultadoValidacaoClassificacao = { valido: true } | { valido: false; erro: string };

/**
 * Valida se a combinação Projeto / Categoria Principal / Subcategoria /
 * Detalhamento é consistente com a nova matriz oficial v7.1 — a mesma
 * checagem usada no servidor (Server Actions) e disponível para os
 * formulários/testes. Sempre roda no servidor antes de salvar; nunca confia
 * apenas na cascata da interface.
 *
 * Regras (hierarquia totalmente obrigatória, sem combinações "soltas"):
 *  - Tudo vazio é válido — representa "nenhuma classificação nova escolhida"
 *    (usado ao editar um atendimento legado sem reclassificá-lo).
 *  - Sem Projeto, nenhum nível abaixo pode estar preenchido.
 *  - Projeto desconhecido é inválido.
 *  - Sem Categoria Principal, Subcategoria/Detalhamento também devem estar
 *    vazios.
 *  - Categoria Principal só é válida se pertencer ao Projeto informado (ex.:
 *    Projeto "IEZ" + Categoria "Ativação" é inválido — "Ativação" não
 *    pertence a IEZ, só aos projetos de campo).
 *  - Subcategoria só é válida se pertencer à Categoria Principal informada
 *    (dentro do Projeto informado).
 *  - Detalhamento só é válido se pertencer à Subcategoria informada.
 */
export function validarClassificacaoSuporte(
  classificacao: ClassificacaoSuporte
): ResultadoValidacaoClassificacao {
  const projeto = classificacao.projeto || null;
  const categoriaPrincipal = classificacao.categoriaPrincipal || null;
  const subcategoria = classificacao.subcategoria || null;
  const detalhamento = classificacao.detalhamento || null;

  if (!projeto) {
    if (categoriaPrincipal || subcategoria || detalhamento) {
      return {
        valido: false,
        erro: "Selecione o Projeto antes de escolher Categoria Principal, Subcategoria ou Detalhamento.",
      };
    }
    return { valido: true };
  }

  const projetoEncontrado = encontrarProjeto(projeto);
  if (!projetoEncontrado) {
    return { valido: false, erro: `"${projeto}" não é um Projeto válido.` };
  }

  if (!categoriaPrincipal) {
    if (subcategoria || detalhamento) {
      return {
        valido: false,
        erro: "Selecione a Categoria Principal antes de escolher Subcategoria ou Detalhamento.",
      };
    }
    return { valido: true };
  }

  const categoria = projetoEncontrado.categorias.find((c) => c.nome === categoriaPrincipal);
  if (!categoria) {
    return {
      valido: false,
      erro: `A Categoria Principal "${categoriaPrincipal}" não pertence ao Projeto "${projeto}".`,
    };
  }

  if (!subcategoria) {
    if (detalhamento) {
      return { valido: false, erro: "Selecione a Subcategoria antes de escolher o Detalhamento." };
    }
    return { valido: true };
  }

  const sub = categoria.subcategorias.find((s) => s.nome === subcategoria);
  if (!sub) {
    return {
      valido: false,
      erro: `A subcategoria "${subcategoria}" não pertence à Categoria Principal "${categoriaPrincipal}".`,
    };
  }

  if (!detalhamento) return { valido: true };

  const detalhamentoValido = sub.detalhamentos.includes(detalhamento);
  if (!detalhamentoValido) {
    return {
      valido: false,
      erro: `O detalhamento "${detalhamento}" não pertence à subcategoria "${subcategoria}".`,
    };
  }

  return { valido: true };
}

/**
 * Junta os níveis preenchidos com " > " (ex.: "NOKIA > MOS > Material > OK").
 * Níveis vazios são omitidos. É este texto que é salvo no campo legado
 * `categoria` a cada criação/edição com classificação nova, para manter
 * compatibilidade com qualquer parte antiga do sistema que ainda leia só
 * `categoria`.
 */
export function formatarCategoriaHierarquica(classificacao: ClassificacaoSuporte): string {
  return [
    classificacao.projeto,
    classificacao.categoriaPrincipal,
    classificacao.subcategoria,
    classificacao.detalhamento,
  ]
    .filter((parte): parte is string => Boolean(parte))
    .join(SEPARADOR);
}

/**
 * Codifica Projeto + Categoria Principal para gravação na coluna
 * `SupportTicket.categoriaPrincipal` (única coluna estruturada disponível
 * para representar o novo nível "Projeto", sem alterar o schema — ver nota
 * no topo do arquivo). Devolve `null` quando nenhum Projeto foi escolhido.
 */
export function combinarProjetoCategoria(
  projeto: string | null | undefined,
  categoriaPrincipal: string | null | undefined
): string | null {
  if (!projeto) return null;
  if (!categoriaPrincipal) return projeto;
  return `${projeto}${SEPARADOR}${categoriaPrincipal}`;
}

export type ProjetoCategoriaPersistida = {
  projeto: string;
  categoriaPrincipal: string | null;
};

/**
 * Decodifica o valor gravado em `SupportTicket.categoriaPrincipal` de volta
 * para `{ projeto, categoriaPrincipal }`, SOMENTE quando o valor casa
 * exatamente com a matriz atual (um Projeto válido, sozinho ou seguido de
 * " > " + uma Categoria Principal que pertença a esse Projeto). Qualquer
 * outro valor — nunca classificado, uma categoria "solta" (sem Projeto) da
 * matriz anterior, ou qualquer formato mais antigo — devolve `null`,
 * sinalizando "trate como categoria legada" para quem chama.
 */
export function interpretarCategoriaPrincipalPersistida(
  valor: string | null | undefined
): ProjetoCategoriaPersistida | null {
  if (!valor) return null;

  const projetos = obterProjetos();

  // Só o Projeto foi escolhido (Categoria Principal ainda vazia).
  if (projetos.includes(valor)) {
    return { projeto: valor, categoriaPrincipal: null };
  }

  const indiceSeparador = valor.indexOf(SEPARADOR);
  if (indiceSeparador === -1) return null; // não é um Projeto puro nem um composto — legado.

  const possivelProjeto = valor.slice(0, indiceSeparador);
  const categoriaCandidata = valor.slice(indiceSeparador + SEPARADOR.length);
  if (!projetos.includes(possivelProjeto)) return null;

  const categoriasDoProjeto = obterCategoriasPrincipais(possivelProjeto);
  if (!categoriasDoProjeto.includes(categoriaCandidata)) return null;

  return { projeto: possivelProjeto, categoriaPrincipal: categoriaCandidata };
}

/**
 * Rótulo de exibição para listagem/relatórios: reconstrói a hierarquia nova
 * completa (Projeto → Categoria Principal → Subcategoria → Detalhamento)
 * quando `categoriaPrincipal` for decodificável contra a matriz atual, ou cai
 * para o valor antigo de `categoria` — sem isso, atendimentos registrados
 * antes desta classificação (ou com uma classificação de uma matriz
 * anterior, que não existe mais aqui) ficariam sem nenhuma categoria visível
 * corretamente formatada.
 */
export function obterRotuloCategoriaExibicao(ticket: {
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  detalhamento: string | null;
  categoria: string;
}): string {
  const decodificado = interpretarCategoriaPrincipalPersistida(ticket.categoriaPrincipal);
  if (!decodificado) return ticket.categoria;
  return formatarCategoriaHierarquica({
    projeto: decodificado.projeto,
    categoriaPrincipal: decodificado.categoriaPrincipal,
    subcategoria: ticket.subcategoria,
    detalhamento: ticket.detalhamento,
  });
}

/**
 * Reconstrói a classificação (Projeto/Categoria/Subcategoria/Detalhamento)
 * atualmente válida de um atendimento já salvo, para popular os selects do
 * formulário de edição — ou `null` quando o atendimento não tem nenhuma
 * classificação decodificável contra a matriz atual (nunca classificado, ou
 * classificado por uma matriz anterior), caso em que a tela de edição deve
 * tratar o atendimento como "categoria legada" (ver app/suporte/[id]/page.tsx).
 *
 * Também valida `subcategoria`/`detalhamento` contra a matriz atual (não
 * apenas confia que estão corretos) — protege contra o caso raro de um
 * registro com `categoriaPrincipal` decodificável mas subcategoria/detalhamento
 * de uma combinação que não existe mais, evitando pré-selecionar algo
 * inconsistente no seletor novo.
 */
export function obterClassificacaoAtualValida(ticket: {
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  detalhamento: string | null;
}): ClassificacaoSuporte | null {
  const decodificado = interpretarCategoriaPrincipalPersistida(ticket.categoriaPrincipal);
  if (!decodificado) return null;

  const { projeto, categoriaPrincipal } = decodificado;

  const subcategoria =
    ticket.subcategoria && obterSubcategorias(projeto, categoriaPrincipal).includes(ticket.subcategoria)
      ? ticket.subcategoria
      : null;

  const detalhamento =
    subcategoria &&
    ticket.detalhamento &&
    obterDetalhamentos(projeto, categoriaPrincipal, subcategoria).includes(ticket.detalhamento)
      ? ticket.detalhamento
      : null;

  return { projeto, categoriaPrincipal, subcategoria, detalhamento };
}
