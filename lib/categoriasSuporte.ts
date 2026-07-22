/**
 * Fonte única da classificação hierárquica de atendimentos da Central de
 * Suporte Técnico (até 3 níveis: Categoria Principal → Subcategoria →
 * Detalhamento), conforme a estrutura oficial definida pelo time. Nenhum
 * outro arquivo deve duplicar esta lista — formulário de criação, edição,
 * listagem, filtros, exportação e testes importam tudo daqui.
 *
 * Os rótulos completos (ex.: "3 - ATIVAÇÃO", "B - ALARMES", "B2 - TESTE
 * FÍSICO") são os valores literais salvos em `SupportTicket.categoriaPrincipal`
 * / `subcategoria` / `detalhamento` — não um código separado — porque é
 * assim que o texto formatado precisa aparecer em `categoria` (campo legado,
 * ver `formatarCategoriaHierarquica`) e em toda a interface, sem uma camada
 * extra de tradução código→rótulo.
 *
 * Este módulo não importa nada do Prisma nem do Next — é puro TypeScript,
 * seguro para uso tanto em Server Components/Actions quanto em Client
 * Components (mesmo padrão já usado por `lib/permissoes.ts`).
 */

export type Grupo = "GRUPO GERAL" | "GRUPO NOKIA";

export type NoDetalhamento = {
  codigo: string;
  nome: string;
};

export type NoSubcategoria = {
  /** Vazio para subcategorias sem código próprio (ex.: "PRESENCIAL", "ON-LINE"). */
  codigo: string;
  nome: string;
  detalhamentos: NoDetalhamento[];
};

export type NoCategoriaPrincipal = {
  codigo: string;
  nome: string;
  grupo: Grupo;
  subcategorias: NoSubcategoria[];
};

function rotulo(codigo: string, nome: string): string {
  return codigo ? `${codigo} - ${nome}` : nome;
}

export function rotuloCategoriaPrincipal(c: NoCategoriaPrincipal): string {
  return rotulo(c.codigo, c.nome);
}

export function rotuloSubcategoria(s: NoSubcategoria): string {
  return rotulo(s.codigo, s.nome);
}

export function rotuloDetalhamento(d: NoDetalhamento): string {
  return rotulo(d.codigo, d.nome);
}

/**
 * Estrutura oficial de categorias da Central de Suporte Técnico. Nomes em
 * português e em caixa alta, exatamente conforme definido pelo time — não
 * alterar sem uma nova definição oficial.
 */
export const CATEGORIAS_SUPORTE_HIERARQUIA: NoCategoriaPrincipal[] = [
  // ============================================================
  // GRUPO GERAL
  // ============================================================
  {
    codigo: "0",
    nome: "INTEGRAÇÃO",
    grupo: "GRUPO GERAL",
    subcategorias: [
      { codigo: "", nome: "PRESENCIAL", detalhamentos: [] },
      { codigo: "", nome: "ON-LINE", detalhamentos: [] },
    ],
  },
  { codigo: "A", nome: "TREINAMENTO", grupo: "GRUPO GERAL", subcategorias: [] },
  { codigo: "B", nome: "USUÁRIO / SENHA / APP", grupo: "GRUPO GERAL", subcategorias: [] },
  { codigo: "C", nome: "COMPUTADOR / SOFTWARE", grupo: "GRUPO GERAL", subcategorias: [] },
  { codigo: "D", nome: "CELULAR / APP", grupo: "GRUPO GERAL", subcategorias: [] },

  // ============================================================
  // GRUPO NOKIA
  // ============================================================
  {
    codigo: "1",
    nome: "MOS",
    grupo: "GRUPO NOKIA",
    subcategorias: [
      { codigo: "A", nome: "APLICATIVOS", detalhamentos: [] },
      { codigo: "B", nome: "ORIENTAÇÃO", detalhamentos: [] },
    ],
  },
  {
    codigo: "2",
    nome: "INSTALAÇÃO",
    grupo: "GRUPO NOKIA",
    subcategorias: [
      { codigo: "A", nome: "ORIENTAÇÃO SOBRE O PROJETO", detalhamentos: [] },
      { codigo: "B", nome: "PADRÃO DE INSTALAÇÃO", detalhamentos: [] },
      { codigo: "C", nome: "HARDWARE", detalhamentos: [] },
    ],
  },
  {
    codigo: "3",
    nome: "ATIVAÇÃO",
    grupo: "GRUPO NOKIA",
    subcategorias: [
      { codigo: "A", nome: "CONFIGURAÇÃO", detalhamentos: [] },
      {
        codigo: "B",
        nome: "ALARMES",
        detalhamentos: [
          { codigo: "B1", nome: "CONFIGURAÇÃO" },
          { codigo: "B2", nome: "TESTE FÍSICO" },
        ],
      },
      { codigo: "C", nome: "ATUALIZAÇÃO DE SOFTWARE", detalhamentos: [] },
      { codigo: "D", nome: "SCRIPT / XML", detalhamentos: [] },
      { codigo: "E", nome: "ORIENTAÇÃO", detalhamentos: [] },
    ],
  },
  {
    codigo: "4",
    nome: "INFRAESTRUTURA",
    grupo: "GRUPO NOKIA",
    subcategorias: [
      {
        codigo: "A",
        nome: "ENERGIA",
        detalhamentos: [
          { codigo: "A1", nome: "CONFIGURAÇÃO" },
          { codigo: "A2", nome: "ALARMES" },
        ],
      },
      {
        codigo: "B",
        nome: "TX",
        detalhamentos: [{ codigo: "B1", nome: "ALARMES" }],
      },
      {
        codigo: "C",
        nome: "FIBRA ÓPTICA",
        detalhamentos: [{ codigo: "C1", nome: "ALARMES" }],
      },
    ],
  },
  {
    codigo: "5",
    nome: "ACEITAÇÃO",
    grupo: "GRUPO NOKIA",
    subcategorias: [
      { codigo: "A", nome: "TESTE DE VOZ / DADOS", detalhamentos: [] },
      { codigo: "B", nome: "ALARMES / RETIRADA", detalhamentos: [] },
      { codigo: "C", nome: "DOCUMENTAÇÃO FOTOGRÁFICA", detalhamentos: [] },
    ],
  },
];

function encontrarCategoriaPrincipal(rotuloCategoria: string | null | undefined): NoCategoriaPrincipal | undefined {
  if (!rotuloCategoria) return undefined;
  return CATEGORIAS_SUPORTE_HIERARQUIA.find((c) => rotuloCategoriaPrincipal(c) === rotuloCategoria);
}

function encontrarSubcategoria(
  rotuloCategoria: string | null | undefined,
  rotuloSub: string | null | undefined
): NoSubcategoria | undefined {
  const categoria = encontrarCategoriaPrincipal(rotuloCategoria);
  if (!categoria || !rotuloSub) return undefined;
  return categoria.subcategorias.find((s) => rotuloSubcategoria(s) === rotuloSub);
}

/** Todas as Categorias Principais (rótulo já formatado, ex.: "3 - ATIVAÇÃO"), com o grupo a que pertencem — para agrupar visualmente ("GRUPO GERAL" / "GRUPO NOKIA") no seletor. */
export function obterCategoriasPrincipais(): { valor: string; grupo: Grupo }[] {
  return CATEGORIAS_SUPORTE_HIERARQUIA.map((c) => ({ valor: rotuloCategoriaPrincipal(c), grupo: c.grupo }));
}

/** Subcategorias (rótulo já formatado) da Categoria Principal informada. Lista vazia se a categoria não existir ou não tiver subcategorias (ex.: "A - TREINAMENTO"). */
export function obterSubcategorias(categoriaPrincipal: string | null | undefined): string[] {
  const categoria = encontrarCategoriaPrincipal(categoriaPrincipal);
  if (!categoria) return [];
  return categoria.subcategorias.map(rotuloSubcategoria);
}

/** Detalhamentos (rótulo já formatado) da Subcategoria informada, dentro da Categoria Principal informada. Lista vazia se a combinação não existir ou a subcategoria não tiver detalhamentos. */
export function obterDetalhamentos(
  categoriaPrincipal: string | null | undefined,
  subcategoria: string | null | undefined
): string[] {
  const sub = encontrarSubcategoria(categoriaPrincipal, subcategoria);
  if (!sub) return [];
  return sub.detalhamentos.map(rotuloDetalhamento);
}

export type ClassificacaoSuporte = {
  categoriaPrincipal?: string | null;
  subcategoria?: string | null;
  detalhamento?: string | null;
};

export type ResultadoValidacaoClassificacao = { valido: true } | { valido: false; erro: string };

/**
 * Valida se a combinação Categoria Principal / Subcategoria / Detalhamento é
 * consistente com a estrutura oficial — a mesma checagem usada no servidor
 * (Server Actions) e disponível para os formulários/testes. Sempre roda no
 * servidor antes de salvar; nunca confia apenas na interface.
 *
 * Regras:
 *  - Sem Categoria Principal, Subcategoria/Detalhamento também devem estar
 *    vazios (não dá para ter um nível 2/3 "solto"). Tudo vazio é válido —
 *    representa "nenhuma classificação nova escolhida" (usado ao editar um
 *    atendimento legado sem reclassificá-lo).
 *  - Categoria Principal desconhecida é inválida.
 *  - Subcategoria só é válida se pertencer à Categoria Principal informada
 *    (ex.: "3 - ATIVAÇÃO" + "A - ENERGIA" é inválido — ENERGIA pertence a
 *    "4 - INFRAESTRUTURA").
 *  - Detalhamento só é válido se pertencer à Subcategoria informada.
 *  - Categoria sem subcategoria (ex.: "A - TREINAMENTO") e subcategoria sem
 *    detalhamento são válidas com o(s) nível(is) seguinte(s) vazio(s).
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

  const sub = categoria.subcategorias.find((s) => rotuloSubcategoria(s) === subcategoria);
  if (!sub) {
    return {
      valido: false,
      erro: `A subcategoria "${subcategoria}" não pertence à Categoria Principal "${categoriaPrincipal}".`,
    };
  }

  if (!detalhamento) return { valido: true };

  const det = sub.detalhamentos.find((d) => rotuloDetalhamento(d) === detalhamento);
  if (!det) {
    return {
      valido: false,
      erro: `O detalhamento "${detalhamento}" não pertence à subcategoria "${subcategoria}".`,
    };
  }

  return { valido: true };
}

/**
 * Junta os níveis preenchidos com " > " (ex.: "3 - ATIVAÇÃO > B - ALARMES >
 * B2 - TESTE FÍSICO"). Níveis vazios são omitidos — "A - TREINAMENTO" sem
 * subcategoria vira só "A - TREINAMENTO". É este texto que é salvo no campo
 * legado `categoria` a cada criação/edição com classificação nova, para
 * manter compatibilidade com qualquer parte antiga do sistema que ainda leia
 * só `categoria`.
 */
export function formatarCategoriaHierarquica(classificacao: ClassificacaoSuporte): string {
  return [classificacao.categoriaPrincipal, classificacao.subcategoria, classificacao.detalhamento]
    .filter((parte): parte is string => Boolean(parte))
    .join(" > ");
}

/**
 * Rótulo de exibição para listagem/relatórios: usa a hierarquia nova quando
 * disponível (`categoriaPrincipal` preenchido) ou cai para o valor antigo de
 * `categoria` — sem isso, atendimentos registrados antes desta classificação
 * ficariam sem nenhuma categoria visível.
 */
export function obterRotuloCategoriaExibicao(ticket: {
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  detalhamento: string | null;
  categoria: string;
}): string {
  if (ticket.categoriaPrincipal) return formatarCategoriaHierarquica(ticket);
  return ticket.categoria;
}
