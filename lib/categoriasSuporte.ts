/**
 * Fonte única da classificação hierárquica de atendimentos da Central de
 * Suporte Técnico. Nenhum outro arquivo deve duplicar esta lista —
 * formulário de criação, edição, listagem, filtros, exportação e relatórios
 * importam tudo daqui (direta ou indiretamente, via `obterRotuloCategoriaExibicao`/
 * `formatarCategoriaHierarquica`/`obterClassificacaoAtualValida`).
 *
 * MISSÃO "Refatoração da Categoria do Atendimento — eliminação do campo
 * Projeto duplicado" (TELEQUIPE SUPORTE STA v7.3): esta é a nova arquitetura
 * OFICIAL, que substitui COMPLETAMENTE a matriz anterior (4 níveis: Projeto
 * → Categoria Principal → Subcategoria → Detalhamento, com o Projeto sendo
 * um dos 5 Fabricantes — IEZ/ERICSSON/HUAWEI/NOKIA/ZTE).
 *
 * O nível "Projeto" foi REMOVIDO desta hierarquia (decisão explícita do
 * usuário, ver conversa da missão): o sistema já tem um único campo
 * "Projeto" oficial — a matriz Projeto × Regional (`lib/projetoRegional.ts`,
 * coluna `SupportTicket.projeto`) — e não deve existir um segundo campo com
 * o mesmo nome aqui. A partir desta missão, Categoria Principal deixa de
 * pertencer a um Fabricante: existe uma ÚNICA lista de Categorias
 * Principais/Subcategorias/Detalhamentos, válida para todos os
 * atendimentos.
 *
 * NOVA HIERARQUIA (3 níveis): Categoria Principal → Subcategoria →
 * Detalhamento.
 *  - 5 Categorias Principais: MOS, Infraestrutura, Instalação, Ativação
 *    (conteúdo revisado conforme a nova lista oficial da missão) e Aceitação
 *    (mantida exatamente como já existia — decisão explícita do usuário de
 *    não remover essa categoria, mesmo não estando na nova lista).
 *  - Nem toda Subcategoria tem Detalhamento — quando não tiver, o campo de
 *    Detalhamento fica desabilitado com "Não se aplica" (mesmo
 *    comportamento de antes, agora simplesmente mais frequente, já que a
 *    nova lista remove o Detalhamento genérico "Geral" que quase toda
 *    Subcategoria tinha).
 *
 * PERSISTÊNCIA (SIMPLIFICADA nesta missão — "Não criar migrations. Não
 * alterar Prisma/Schema"): como não existe mais um nível "Projeto" aqui para
 * codificar, a coluna `SupportTicket.categoriaPrincipal` agora grava
 * DIRETAMENTE o nome da Categoria Principal escolhida (ex.: "MOS"), sem
 * nenhum prefixo — `subcategoria`/`detalhamento` continuam suas próprias
 * colunas simples, como já eram.
 *
 * COMPATIBILIDADE COM ATENDIMENTOS ANTIGOS (regra explícita da missão: "Não
 * quebrar chamados antigos. Não apagar dados."). `categoriaPrincipalValida`
 * só reconhece um valor que seja EXATAMENTE um dos 5 nomes de Categoria
 * Principal atuais. Qualquer outro valor — nunca classificado, um valor
 * "Projeto" ou "Projeto > Categoria" de uma matriz anterior (ex.: "NOKIA",
 * "NOKIA > MOS" — formato usado até a missão passada), uma categoria "solta"
 * de uma matriz ainda mais antiga (ex.: "3 - ATIVAÇÃO"), ou qualquer coisa
 * que não bata exatamente — é tratado como "categoria legada": o restante do
 * sistema exibe o texto já salvo (`categoria`) sem tentar traduzir, migrar
 * ou pré-selecionar nada no seletor novo. Editar um desses atendimentos sem
 * mexer no seletor de categoria preserva o valor legado 100% intacto (ver
 * `updateTicket` em app/suporte/actions.ts). Este é o MESMO mecanismo já
 * usado nas duas revisões anteriores da hierarquia — só ficou mais simples
 * porque não há mais nada para decodificar além do próprio nome da
 * Categoria Principal.
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

const SEPARADOR = " > ";

/**
 * Matriz completa oficial (missão "Refatoração da Categoria do Atendimento",
 * v7.3): 5 Categorias Principais, sem nível de Projeto/Fabricante. MOS,
 * Infraestrutura, Instalação e Ativação seguem a nova lista oficial da
 * missão (nomes/subcategorias/detalhamentos revisados — a maioria das
 * Subcategorias deixou de ter um Detalhamento genérico "Geral"). Aceitação
 * foi mantida exatamente como já existia antes desta missão (decisão
 * explícita do usuário — não fazia parte da nova lista, mas não deve ser
 * removida).
 */
export const CATEGORIAS_SUPORTE: NoCategoriaPrincipal[] = [
  {
    nome: "MOS",
    subcategorias: [
      { nome: "Log de Antes", detalhamentos: [] },
      { nome: "EHS", detalhamentos: ["Aplicativos", "Orientações"] },
      { nome: "Logística / Transportadora", detalhamentos: [] },
      { nome: "Material", detalhamentos: ["OK", "NOK"] },
      { nome: "Aplicativos", detalhamentos: [] },
      { nome: "Orientação", detalhamentos: [] },
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
      { nome: "Orientação sobre o Projeto", detalhamentos: [] },
      { nome: "Padrão de Instalação", detalhamentos: [] },
      { nome: "Hardware", detalhamentos: ["Avarias", "Falhas"] },
      { nome: "Ferramentas", detalhamentos: [] },
    ],
  },
  {
    nome: "Ativação",
    subcategorias: [
      { nome: "Configuração", detalhamentos: ["Controladora", "Periféricos", "Energia"] },
      { nome: "Alarmes", detalhamentos: ["Configuração", "Teste Físico"] },
      { nome: "Atualização SW", detalhamentos: [] },
      { nome: "Script / XML", detalhamentos: [] },
      { nome: "Orientação", detalhamentos: [] },
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

function encontrarCategoriaPrincipal(nomeCategoria: string | null | undefined): NoCategoriaPrincipal | undefined {
  if (!nomeCategoria) return undefined;
  return CATEGORIAS_SUPORTE.find((c) => c.nome === nomeCategoria);
}

function encontrarSubcategoria(
  nomeCategoria: string | null | undefined,
  nomeSub: string | null | undefined
): NoSubcategoria | undefined {
  const categoria = encontrarCategoriaPrincipal(nomeCategoria);
  if (!categoria || !nomeSub) return undefined;
  return categoria.subcategorias.find((s) => s.nome === nomeSub);
}

/** Todas as Categorias Principais, na ordem oficial (MOS, Infraestrutura, Instalação, Ativação, Aceitação). */
export function obterCategoriasPrincipais(): string[] {
  return CATEGORIAS_SUPORTE.map((c) => c.nome);
}

/** Subcategorias da Categoria Principal informada. Lista vazia se a Categoria não existir ou não estiver informada. */
export function obterSubcategorias(categoriaPrincipal: string | null | undefined): string[] {
  const categoria = encontrarCategoriaPrincipal(categoriaPrincipal);
  if (!categoria) return [];
  return categoria.subcategorias.map((s) => s.nome);
}

/** Detalhamentos da Subcategoria informada, dentro da Categoria Principal informada. Lista vazia se a combinação não existir ou a Subcategoria não tiver Detalhamento (caso em que a tela deve mostrar "Não se aplica"). */
export function obterDetalhamentos(
  categoriaPrincipal: string | null | undefined,
  subcategoria: string | null | undefined
): string[] {
  const sub = encontrarSubcategoria(categoriaPrincipal, subcategoria);
  if (!sub) return [];
  return sub.detalhamentos.slice();
}

export type ClassificacaoSuporte = {
  categoriaPrincipal?: string | null;
  subcategoria?: string | null;
  detalhamento?: string | null;
};

export type ResultadoValidacaoClassificacao = { valido: true } | { valido: false; erro: string };

/**
 * Valida se a combinação Categoria Principal / Subcategoria / Detalhamento é
 * consistente com a matriz oficial atual — a mesma checagem usada no
 * servidor (Server Actions) e disponível para os formulários/testes. Sempre
 * roda no servidor antes de salvar; nunca confia apenas na cascata da
 * interface.
 *
 * Regras (hierarquia totalmente obrigatória, sem combinações "soltas"):
 *  - Tudo vazio é válido — representa "nenhuma classificação nova escolhida"
 *    (usado ao editar um atendimento legado sem reclassificá-lo).
 *  - Categoria Principal desconhecida é inválida.
 *  - Sem Categoria Principal, Subcategoria/Detalhamento também devem estar
 *    vazios.
 *  - Subcategoria só é válida se pertencer à Categoria Principal informada.
 *  - Detalhamento só é válido se pertencer à Subcategoria informada.
 */
export function validarClassificacaoSuporte(
  classificacao: ClassificacaoSuporte
): ResultadoValidacaoClassificacao {
  const categoriaPrincipal = classificacao.categoriaPrincipal || null;
  const subcategoria = classificacao.subcategoria || null;
  const detalhamento = classificacao.detalhamento || null;

  if (!categoriaPrincipal) {
    if (subcategoria || detalhamento) {
      return {
        valido: false,
        erro: "Selecione a Categoria Principal antes de escolher Subcategoria ou Detalhamento.",
      };
    }
    return { valido: true };
  }

  const categoria = encontrarCategoriaPrincipal(categoriaPrincipal);
  if (!categoria) {
    return { valido: false, erro: `"${categoriaPrincipal}" não é uma Categoria Principal válida.` };
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
 * Junta os níveis preenchidos com " > " (ex.: "MOS > Material > OK").
 * Níveis vazios são omitidos. É este texto que é salvo no campo legado
 * `categoria` a cada criação/edição com classificação nova, para manter
 * compatibilidade com qualquer parte antiga do sistema que ainda leia só
 * `categoria`.
 */
export function formatarCategoriaHierarquica(classificacao: ClassificacaoSuporte): string {
  return [classificacao.categoriaPrincipal, classificacao.subcategoria, classificacao.detalhamento]
    .filter((parte): parte is string => Boolean(parte))
    .join(SEPARADOR);
}

/**
 * Confirma se o valor gravado em `SupportTicket.categoriaPrincipal` é uma
 * Categoria Principal válida da matriz ATUAL (match exato — sem nenhum
 * prefixo de Projeto, que não existe mais nesta hierarquia). Devolve o
 * próprio valor quando válido, ou `null` quando não for — sinalizando "trate
 * como categoria legada" para quem chama (nunca classificado, valor de uma
 * matriz anterior com Projeto embutido como "NOKIA > MOS", ou qualquer
 * formato mais antigo ainda).
 */
export function categoriaPrincipalValida(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return obterCategoriasPrincipais().includes(valor) ? valor : null;
}

/**
 * Rótulo de exibição para listagem/relatórios: reconstrói a hierarquia
 * completa (Categoria Principal → Subcategoria → Detalhamento) quando
 * `categoriaPrincipal` for uma Categoria Principal válida da matriz atual,
 * ou cai para o valor antigo de `categoria` — sem isso, atendimentos
 * registrados antes desta classificação (ou com uma classificação de uma
 * matriz anterior, que não existe mais aqui) ficariam sem nenhuma categoria
 * visível corretamente formatada.
 */
export function obterRotuloCategoriaExibicao(ticket: {
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  detalhamento: string | null;
  categoria: string;
}): string {
  const categoriaPrincipal = categoriaPrincipalValida(ticket.categoriaPrincipal);
  if (!categoriaPrincipal) return ticket.categoria;
  return formatarCategoriaHierarquica({
    categoriaPrincipal,
    subcategoria: ticket.subcategoria,
    detalhamento: ticket.detalhamento,
  });
}

/**
 * Reconstrói a classificação (Categoria/Subcategoria/Detalhamento)
 * atualmente válida de um atendimento já salvo, para popular os selects do
 * formulário de edição — ou `null` quando o atendimento não tem nenhuma
 * classificação decodificável contra a matriz atual (nunca classificado, ou
 * classificado por uma matriz anterior), caso em que a tela de edição deve
 * tratar o atendimento como "categoria legada" (ver app/suporte/[id]/page.tsx).
 *
 * Também valida `subcategoria`/`detalhamento` contra a matriz atual (não
 * apenas confia que estão corretos) — protege contra o caso raro de um
 * registro com `categoriaPrincipal` válida mas subcategoria/detalhamento de
 * uma combinação que não existe mais, evitando pré-selecionar algo
 * inconsistente no seletor novo.
 */
export function obterClassificacaoAtualValida(ticket: {
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  detalhamento: string | null;
}): ClassificacaoSuporte | null {
  const categoriaPrincipal = categoriaPrincipalValida(ticket.categoriaPrincipal);
  if (!categoriaPrincipal) return null;

  const subcategoria =
    ticket.subcategoria && obterSubcategorias(categoriaPrincipal).includes(ticket.subcategoria)
      ? ticket.subcategoria
      : null;

  const detalhamento =
    subcategoria &&
    ticket.detalhamento &&
    obterDetalhamentos(categoriaPrincipal, subcategoria).includes(ticket.detalhamento)
      ? ticket.detalhamento
      : null;

  return { categoriaPrincipal, subcategoria, detalhamento };
}
