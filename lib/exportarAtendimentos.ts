import ExcelJS from "exceljs";
import {
  CATEGORIAS_SUPORTE,
  STATUS_SUPORTE,
  type FiltrosSuporte,
} from "@/lib/suporte";
import { categoriaPrincipalValida } from "@/lib/categoriasSuporte";

/**
 * Exportação em Excel (.xlsx) da tela /suporte ("Suporte Técnico").
 *
 * Este módulo é intencionalmente independente dos tipos gerados pelo Prisma
 * (`Prisma.SupportTicketGetPayload<...>`): a rota (`app/suporte/exportar/route.ts`)
 * busca os tickets no banco e os converte para o formato simples
 * `AtendimentoParaExportacao` abaixo — o mesmo padrão de "linha simples" já usado em
 * `app/suporte/page.tsx` (variável `tickets`) e em `lib/suporte.ts`
 * (`getUltimosAtendimentos`). Isso mantém toda a lógica de geração da planilha
 * pura e testável sem precisar de conexão com o banco.
 *
 * Biblioteca escolhida: `exceljs` (nova dependência), não o `xlsx` (SheetJS) já
 * instalado no projeto. Motivo: a edição gratuita do `xlsx` não suporta de forma
 * confiável negrito/estilos de célula nem painéis congelados — dois requisitos
 * explícitos desta exportação — apenas a edição paga ("Pro") suporta. O `xlsx`
 * já instalado continua sendo usado exclusivamente por `lib/colaboradores.ts`
 * para *ler* a planilha oficial do Smart Sync; esta exportação nunca importa
 * nem depende desse módulo.
 */

// ============================================================
// Tipos
// ============================================================

export type FiltrosExportacao = FiltrosSuporte;

/** Formato "linha simples" que a rota monta a partir do resultado do Prisma. */
export type AtendimentoParaExportacao = {
  numero: number;
  dataAtendimento: Date;
  horaInicio: string;
  horaFim: string | null;
  status: string;
  colaboradorNome: string | null;
  colaboradorTelefone: string | null;
  colaboradorRegional: string | null;
  /** Snapshot histórico (atendimentos anteriores à reestruturação V6 — ver schema.prisma). */
  liderNomeHistorico: string | null;
  projeto: string | null;
  /** Site atendido (ex.: "SN-AQDIK4"), campo `SupportTicket.site` — coluna "Site" do relatório. */
  site: string | null;
  /** Coluna "Cliente" do relatório (antes de o campo `site` existir, esta coluna se chamava "Site" e usava este mesmo valor como aproximação — ver histórico da migration `20260722140000_add_site_suporte`). */
  cliente: string | null;
  /** Campo legado (obrigatório) — sempre preenchido. Usado como fallback nas colunas de categoria para atendimentos antigos sem classificação hierárquica (ver montarLinhaPlanilha). */
  categoria: string;
  categoriaPrincipal: string | null;
  subcategoria: string | null;
  detalhamento: string | null;
  descricaoProblema: string;
  tecnicoResponsavel: string | null;
  solucaoAplicada: string | null;
  resultado: string;
  /** Minutos, já calculado (mesma regra de `calcularTempoAtendimento`). */
  tempoAtendimento: number | null;
  observacoes: string | null;
  /** Usado como aproximação de "encerrado em" quando status === "Finalizado" — ver nota abaixo. */
  updatedAt: Date;
};

export type ResultadoValidacaoFiltros = {
  filtros: FiltrosExportacao;
  /** Mensagens de erro em campos claramente malformados (data inválida, id não numérico). */
  erros: string[];
};

// ============================================================
// Validação de filtros (backend nunca confia apenas no que o frontend manda)
// ============================================================

const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const TAMANHO_MAXIMO_TEXTO_LIVRE = 200;

function dataIsoValida(valor: string): boolean {
  if (!REGEX_DATA_ISO.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function textoLivreSeguro(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined;
  // eslint-disable-next-line no-control-regex
  const semControle = valor.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
  if (!semControle) return undefined;
  return semControle.slice(0, TAMANHO_MAXIMO_TEXTO_LIVRE);
}

/**
 * Valida e sanitiza os filtros vindos da query string da própria rota de
 * exportação (mesma origem — os `searchParams` da URL — que `app/suporte/page.tsx`
 * já usa para a listagem em tela, então a exportação sempre reflete exatamente o
 * que está sendo exibido). Nunca lança: valores claramente malformados viram
 * mensagens em `erros`; valores fora da allowlist (categoria/status) ou
 * simplesmente ausentes são tratados como "sem filtro" para aquele campo, sem
 * quebrar a exportação inteira.
 */
export function validarFiltrosExportacao(
  params: URLSearchParams
): ResultadoValidacaoFiltros {
  const erros: string[] = [];
  const filtros: FiltrosExportacao = {};

  const dataInicioRaw = params.get("data_inicio");
  if (dataInicioRaw) {
    if (dataIsoValida(dataInicioRaw)) filtros.dataInicio = dataInicioRaw;
    else erros.push("Período inicial inválido.");
  }

  const dataFimRaw = params.get("data_fim");
  if (dataFimRaw) {
    if (dataIsoValida(dataFimRaw)) filtros.dataFim = dataFimRaw;
    else erros.push("Período final inválido.");
  }

  if (
    filtros.dataInicio &&
    filtros.dataFim &&
    filtros.dataInicio > filtros.dataFim
  ) {
    erros.push("O período inicial não pode ser depois do período final.");
  }

  const colaboradorIdRaw = params.get("colaborador_id");
  if (colaboradorIdRaw) {
    const id = Number(colaboradorIdRaw);
    if (Number.isInteger(id) && id > 0) filtros.colaboradorId = id;
    else erros.push("Colaborador selecionado é inválido.");
  }

  const categoriaRaw = params.get("categoria");
  if (categoriaRaw && (CATEGORIAS_SUPORTE as readonly string[]).includes(categoriaRaw)) {
    filtros.categoria = categoriaRaw;
  }

  const statusRaw = params.get("status");
  if (statusRaw && (STATUS_SUPORTE as readonly string[]).includes(statusRaw)) {
    filtros.status = statusRaw;
  }

  const projeto = textoLivreSeguro(params.get("projeto"));
  if (projeto) filtros.projeto = projeto;

  const tecnico = textoLivreSeguro(params.get("tecnico"));
  if (tecnico) filtros.tecnico = tecnico;

  const site = textoLivreSeguro(params.get("site"));
  if (site) filtros.site = site;

  const categoriaPrincipal = textoLivreSeguro(params.get("categoria_principal"));
  if (categoriaPrincipal) filtros.categoriaPrincipal = categoriaPrincipal;

  const subcategoriaFiltro = textoLivreSeguro(params.get("subcategoria"));
  if (subcategoriaFiltro) filtros.subcategoria = subcategoriaFiltro;

  const detalhamentoFiltro = textoLivreSeguro(params.get("detalhamento"));
  if (detalhamentoFiltro) filtros.detalhamento = detalhamentoFiltro;

  const busca = textoLivreSeguro(params.get("busca"));
  if (busca) filtros.busca = busca;

  return { filtros, erros };
}

// ============================================================
// Proteção contra fórmulas maliciosas / valores inválidos em célula
// ============================================================

const GATILHOS_FORMULA = new Set(["=", "+", "-", "@"]);

/**
 * Converte qualquer valor em um texto seguro para célula do Excel:
 * - `null`/`undefined` viram string vazia (nunca "null"/"undefined" literal);
 * - objetos/arrays nunca vazam como "[object Object]" (só string/number/boolean
 *   são aceitos — qualquer outro tipo vira "");
 * - se o texto começar com `=`, `+`, `-` ou `@`, um apóstrofo é prefixado para
 *   impedir que o Excel/Sheets interprete o conteúdo como fórmula (mitigação
 *   padrão de "CSV/Excel formula injection").
 */
export function sanitizarCelulaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor !== "string") return "";
  if (valor.length === 0) return valor;
  return GATILHOS_FORMULA.has(valor[0]) ? `'${valor}` : valor;
}

// ============================================================
// Formatação
// ============================================================

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2h17min" / "45min" / "0min". `null`/`undefined` viram "" (sem dado). */
export function formatarDuracaoExportacao(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return "";
  const total = Math.max(0, Math.round(minutos));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return horas > 0 ? `${horas}h${resto}min` : `${resto}min`;
}

/** Normaliza "H:mm"/"HH:mm" para sempre "HH:mm". Qualquer outra coisa vira "". */
export function formatarHoraExportacao(hora: string | null | undefined): string {
  if (!hora) return "";
  const m = hora.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return `${doisDigitos(h)}:${doisDigitos(min)}`;
}

function formatarDataBR(data: Date): string {
  return `${doisDigitos(data.getUTCDate())}/${doisDigitos(data.getUTCMonth() + 1)}/${data.getUTCFullYear()}`;
}

// ============================================================
// Nome do arquivo
// ============================================================

/**
 * `relatorio-atendimentos-AAAA-MM-DD.xlsx` (data de geração) por padrão, ou
 * `relatorio-atendimentos-AAAA-MM-DD-a-AAAA-MM-DD.xlsx` quando o período
 * (início E fim) estiver filtrado. Se só um dos dois limites do período
 * estiver preenchido, usa o padrão de data única (data de geração) — não há
 * um par de datas completo para formar o intervalo do nome do arquivo.
 */
export function montarNomeArquivo(filtros: FiltrosExportacao, agora: Date): string {
  const hoje = `${agora.getUTCFullYear()}-${doisDigitos(agora.getUTCMonth() + 1)}-${doisDigitos(agora.getUTCDate())}`;
  if (filtros.dataInicio && filtros.dataFim) {
    return `relatorio-atendimentos-${filtros.dataInicio}-a-${filtros.dataFim}.xlsx`;
  }
  return `relatorio-atendimentos-${hoje}.xlsx`;
}

// ============================================================
// Resumo (aba 2)
// ============================================================

const RESULTADOS_NAO_RESOLVIDOS = new Set([
  "Encaminhado Engenharia",
  "Aguardando Cliente",
  "Aguardando Material",
  "Cancelado",
]);

export type ContagemResumo = { nome: string; quantidade: number };

export type ResumoExportacao = {
  periodoSelecionado: string;
  geradoEm: Date;
  totalAtendimentos: number;
  totalResolvido: number;
  totalResolvidoParcial: number;
  totalNaoResolvido: number;
  totalPendente: number;
  tempoMedioAtendimento: string;
  porProjeto: ContagemResumo[];
  porCategoria: ContagemResumo[];
  porRegional: ContagemResumo[];
  porTecnico: ContagemResumo[];
};

function contarPor(
  tickets: AtendimentoParaExportacao[],
  chave: (t: AtendimentoParaExportacao) => string | null,
  rotuloVazio: string
): ContagemResumo[] {
  const mapa = new Map<string, number>();
  for (const t of tickets) {
    const valor = chave(t)?.trim() || rotuloVazio;
    mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
  }
  return Array.from(mapa.entries())
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome));
}

export function montarPeriodoSelecionado(filtros: FiltrosExportacao): string {
  if (filtros.dataInicio && filtros.dataFim) {
    return `${filtros.dataInicio.split("-").reverse().join("/")} a ${filtros.dataFim.split("-").reverse().join("/")}`;
  }
  if (filtros.dataInicio) return `A partir de ${filtros.dataInicio.split("-").reverse().join("/")}`;
  if (filtros.dataFim) return `Até ${filtros.dataFim.split("-").reverse().join("/")}`;
  return "Todos os períodos";
}

export function calcularResumo(
  tickets: AtendimentoParaExportacao[],
  filtros: FiltrosExportacao,
  agora: Date
): ResumoExportacao {
  const totalResolvido = tickets.filter((t) => t.resultado === "Resolvido").length;
  const totalResolvidoParcial = tickets.filter((t) => t.resultado === "Resolvido Parcialmente").length;
  const totalNaoResolvido = tickets.filter((t) => RESULTADOS_NAO_RESOLVIDOS.has(t.resultado)).length;
  const totalPendente = tickets.filter((t) => t.status !== "Finalizado").length;

  const temposValidos = tickets
    .map((t) => t.tempoAtendimento)
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  const tempoMedioMinutos =
    temposValidos.length > 0
      ? temposValidos.reduce((soma, v) => soma + v, 0) / temposValidos.length
      : null;

  return {
    periodoSelecionado: montarPeriodoSelecionado(filtros),
    geradoEm: agora,
    totalAtendimentos: tickets.length,
    totalResolvido,
    totalResolvidoParcial,
    totalNaoResolvido,
    totalPendente,
    tempoMedioAtendimento: tempoMedioMinutos === null ? "" : formatarDuracaoExportacao(tempoMedioMinutos),
    porProjeto: contarPor(tickets, (t) => t.projeto, "Sem projeto"),
    porCategoria: contarPor(tickets, (t) => t.categoria, "Sem categoria"),
    porRegional: contarPor(tickets, (t) => t.colaboradorRegional, "Sem regional"),
    porTecnico: contarPor(tickets, (t) => t.tecnicoResponsavel, "Sem técnico responsável"),
  };
}

// ============================================================
// Colunas da aba "Atendimentos"
// ============================================================

export const COLUNAS_ATENDIMENTOS = [
  "Número",
  "Data de abertura",
  "Hora de abertura",
  "Data de encerramento",
  "Hora de encerramento",
  "Colaborador",
  "Telefone",
  "Regional",
  "Projeto",
  "Site",
  "Cliente",
  "Categoria Principal",
  "Subcategoria",
  "Detalhamento",
  "Descrição",
  "Técnico responsável",
  "Solução aplicada",
  "Resultado",
  "Status",
  "Tempo de atendimento",
  "Observações",
] as const;

/**
 * Monta uma linha (21 valores, na ordem de `COLUNAS_ATENDIMENTOS`) já sanitizada.
 *
 * "Data/Hora de encerramento": não existe timestamp de encerramento na
 * tabela. Quando `status === "Finalizado"`, usamos `updatedAt` (atualizado
 * automaticamente pela Server Action `closeTicket`) como aproximação — caso
 * contrário ficam em branco. Se o atendimento finalizado for editado depois,
 * `updatedAt` deixa de refletir exatamente o momento do encerramento; é a
 * melhor aproximação disponível sem um campo dedicado.
 *
 * "Site" (coluna nova) usa o campo `site` de verdade (`SupportTicket.site`,
 * adicionado pela migration `20260722140000_add_site_suporte`). "Cliente"
 * (coluna já existente, só renomeada de "Site" para "Cliente" — mesmo dado
 * de sempre, `t.cliente`, sem nenhuma mudança de valor ou lógica) continua
 * exatamente como era.
 *
 * "Categoria Principal" / "Subcategoria" / "Detalhamento" (3 colunas,
 * substituindo a antiga coluna única "Categoria" — decisão já validada em
 * missões anteriores: nenhuma coluna existente é removida da planilha sem
 * necessidade, apenas a representação da categoria ganha mais colunas, na
 * mesma posição).
 *
 * MISSÃO "Refatoração da Categoria do Atendimento — eliminação do campo
 * Projeto duplicado" (v7.3): a coluna "Projeto (Categoria)" (introduzida na
 * v7.1 para o antigo nível "Projeto" por Fabricante — IEZ/ERICSSON/HUAWEI/
 * NOKIA/ZTE — da hierarquia de categorias) foi REMOVIDA desta exportação —
 * decisão explícita do usuário de eliminar a dimensão Fabricante de filtros/
 * dashboard/exportação. A coluna "Projeto" que permanece na planilha
 * (posição inalterada) sempre foi e continua sendo só a do cliente, texto
 * livre, campo `SupportTicket.projeto` — a partir de missões anteriores,
 * populada pela matriz oficial Projeto × Regional.
 *
 * "Categoria Principal" usa `categoriaPrincipalValida` (lib/categoriasSuporte.ts)
 * para decidir a fonte do valor:
 *  - Quando `categoriaPrincipal` é uma das 5 Categorias Principais atuais
 *    (atendimento novo, classificado pela matriz atual): "Categoria
 *    Principal" recebe esse valor.
 *  - Quando NÃO é (atendimento nunca classificado, ou classificado por uma
 *    matriz anterior — com ou sem Projeto/Fabricante embutido, ex.:
 *    "NOKIA > MOS"): "Categoria Principal" recebe o valor legado
 *    (`categoriaPrincipal` bruto se existir, senão `categoria`) — mesmo
 *    comportamento de fallback já usado antes desta missão, preservado sem
 *    alteração para não mexer no histórico. "Subcategoria" e "Detalhamento"
 *    ficam vazios nesse caso (mesmo padrão de célula vazia já usado para
 *    qualquer outro campo opcional ausente).
 */
export function montarLinhaPlanilha(t: AtendimentoParaExportacao): Array<string | number | Date> {
  const finalizado = t.status === "Finalizado";
  const categoriaValida = categoriaPrincipalValida(t.categoriaPrincipal);
  return [
    t.numero,
    t.dataAtendimento,
    sanitizarCelulaTexto(formatarHoraExportacao(t.horaInicio)),
    finalizado ? t.updatedAt : "",
    finalizado ? sanitizarCelulaTexto(formatarHoraExportacao(`${doisDigitos(t.updatedAt.getUTCHours())}:${doisDigitos(t.updatedAt.getUTCMinutes())}`)) : "",
    sanitizarCelulaTexto(t.colaboradorNome ?? t.liderNomeHistorico),
    sanitizarCelulaTexto(t.colaboradorTelefone),
    sanitizarCelulaTexto(t.colaboradorRegional),
    sanitizarCelulaTexto(t.projeto),
    sanitizarCelulaTexto(t.site),
    sanitizarCelulaTexto(t.cliente),
    sanitizarCelulaTexto(categoriaValida ?? (t.categoriaPrincipal || t.categoria)),
    sanitizarCelulaTexto(t.subcategoria),
    sanitizarCelulaTexto(t.detalhamento),
    sanitizarCelulaTexto(t.descricaoProblema),
    sanitizarCelulaTexto(t.tecnicoResponsavel),
    sanitizarCelulaTexto(t.solucaoAplicada),
    sanitizarCelulaTexto(t.resultado),
    sanitizarCelulaTexto(t.status),
    sanitizarCelulaTexto(formatarDuracaoExportacao(t.tempoAtendimento)),
    sanitizarCelulaTexto(t.observacoes),
  ];
}

// ============================================================
// Geração do workbook (.xlsx)
// ============================================================

const LARGURAS_COLUNAS: Record<(typeof COLUNAS_ATENDIMENTOS)[number], number> = {
  Número: 10,
  "Data de abertura": 15,
  "Hora de abertura": 13,
  "Data de encerramento": 16,
  "Hora de encerramento": 16,
  Colaborador: 26,
  Telefone: 16,
  Regional: 14,
  Projeto: 20,
  Site: 20,
  Cliente: 20,
  "Categoria Principal": 22,
  Subcategoria: 24,
  Detalhamento: 24,
  Descrição: 42,
  "Técnico responsável": 22,
  "Solução aplicada": 42,
  Resultado: 22,
  Status: 16,
  "Tempo de atendimento": 18,
  Observações: 36,
};

const COLUNAS_QUEBRA_TEXTO = new Set(["Descrição", "Solução aplicada", "Observações"]);

const ESTILO_TITULO: Partial<ExcelJS.Style> = {
  font: { bold: true, size: 14, color: { argb: "FF1F2933" } },
};

const ESTILO_CABECALHO: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } },
  alignment: { vertical: "middle", horizontal: "center", wrapText: true },
};

function montarAbaAtendimentos(workbook: ExcelJS.Workbook, tickets: AtendimentoParaExportacao[]): void {
  const aba = workbook.addWorksheet("Atendimentos", {
    views: [{ state: "frozen", ySplit: 2 }], // congela título + cabeçalho
  });

  aba.mergeCells(1, 1, 1, COLUNAS_ATENDIMENTOS.length);
  const celulaTitulo = aba.getCell(1, 1);
  celulaTitulo.value = "Relatório de Atendimentos — Suporte Técnico";
  celulaTitulo.style = ESTILO_TITULO;
  aba.getRow(1).height = 22;

  const linhaCabecalho = aba.getRow(2);
  COLUNAS_ATENDIMENTOS.forEach((titulo, i) => {
    const celula = linhaCabecalho.getCell(i + 1);
    celula.value = titulo;
    celula.style = ESTILO_CABECALHO;
  });
  linhaCabecalho.height = 30;

  aba.columns = COLUNAS_ATENDIMENTOS.map((titulo) => ({
    width: LARGURAS_COLUNAS[titulo],
  }));

  for (const t of tickets) {
    const valores = montarLinhaPlanilha(t);
    const linha = aba.addRow(valores);
    linha.eachCell((celula, colNumero) => {
      const titulo = COLUNAS_ATENDIMENTOS[colNumero - 1];
      if (titulo === "Data de abertura" || titulo === "Data de encerramento") {
        celula.numFmt = "dd/mm/yyyy";
      }
      if (COLUNAS_QUEBRA_TEXTO.has(titulo)) {
        celula.alignment = { wrapText: true, vertical: "top" };
      }
    });
  }

  aba.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: COLUNAS_ATENDIMENTOS.length },
  };
}

function adicionarLinhaResumo(aba: ExcelJS.Worksheet, rotulo: string, valor: string | number): void {
  const linha = aba.addRow([rotulo, valor]);
  linha.getCell(1).font = { bold: true };
}

function adicionarTabelaContagem(aba: ExcelJS.Worksheet, titulo: string, itens: ContagemResumo[]): void {
  aba.addRow([]);
  const linhaTitulo = aba.addRow([titulo]);
  linhaTitulo.getCell(1).font = { bold: true };
  const linhaCabecalho = aba.addRow(["Nome", "Quantidade"]);
  linhaCabecalho.eachCell((c) => (c.style = ESTILO_CABECALHO));
  if (itens.length === 0) {
    aba.addRow(["Sem dados", 0]);
    return;
  }
  for (const item of itens) {
    aba.addRow([sanitizarCelulaTexto(item.nome), item.quantidade]);
  }
}

function montarAbaResumo(workbook: ExcelJS.Workbook, resumo: ResumoExportacao): void {
  const aba = workbook.addWorksheet("Resumo", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  aba.columns = [{ width: 34 }, { width: 22 }];

  aba.mergeCells(1, 1, 1, 2);
  const celulaTitulo = aba.getCell(1, 1);
  celulaTitulo.value = "Resumo do Relatório de Atendimentos";
  celulaTitulo.style = ESTILO_TITULO;
  aba.getRow(1).height = 22;

  const linhaCabecalho = aba.getRow(2);
  linhaCabecalho.getCell(1).value = "Indicador";
  linhaCabecalho.getCell(2).value = "Valor";
  linhaCabecalho.eachCell((c) => (c.style = ESTILO_CABECALHO));

  adicionarLinhaResumo(aba, "Período selecionado", resumo.periodoSelecionado);
  const celulaData = aba.addRow(["Data e hora da geração", resumo.geradoEm]);
  celulaData.getCell(1).font = { bold: true };
  celulaData.getCell(2).numFmt = "dd/mm/yyyy hh:mm";

  adicionarLinhaResumo(aba, "Total de atendimentos", resumo.totalAtendimentos);
  adicionarLinhaResumo(aba, "Total resolvido", resumo.totalResolvido);
  adicionarLinhaResumo(aba, "Total resolvido parcialmente", resumo.totalResolvidoParcial);
  adicionarLinhaResumo(aba, "Total não resolvido", resumo.totalNaoResolvido);
  adicionarLinhaResumo(aba, "Total pendente", resumo.totalPendente);
  adicionarLinhaResumo(aba, "Tempo médio de atendimento", resumo.tempoMedioAtendimento || "—");

  adicionarTabelaContagem(aba, "Quantidade por projeto", resumo.porProjeto);
  adicionarTabelaContagem(aba, "Quantidade por categoria", resumo.porCategoria);
  adicionarTabelaContagem(aba, "Quantidade por regional", resumo.porRegional);
  adicionarTabelaContagem(aba, "Quantidade por técnico responsável", resumo.porTecnico);
}

/** Gera o workbook completo (duas abas) e retorna o buffer pronto para download. */
export async function gerarWorkbookAtendimentos(
  tickets: AtendimentoParaExportacao[],
  filtros: FiltrosExportacao,
  agora: Date
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Suporte Telequipe";
  workbook.created = agora;

  montarAbaAtendimentos(workbook, tickets);
  montarAbaResumo(workbook, calcularResumo(tickets, filtros, agora));

  return workbook.xlsx.writeBuffer();
}
