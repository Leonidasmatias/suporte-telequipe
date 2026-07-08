import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

/**
 * Motor do CADASTRO MESTRE DE COLABORADORES (V6).
 *
 * Fonte oficial única: um arquivo Excel corporativo com as colunas Nome,
 * TipoPessoa, Regional, Cadastro, EmpresaNome, Cargo, Telefone. Não existe
 * mais separação entre líder/instalador nem agrupamento por equipe — todo
 * profissional é um Colaborador, e a função (Cargo) é só mais um atributo.
 *
 * Este arquivo tem três camadas:
 *  1. Parsing puro (sem banco): `analisarWorkbookColaboradores` — localiza a
 *     tabela de pessoas pelo CONTEÚDO das células (não pela posição fixa) e
 *     devolve os colaboradores normalizados + validados estruturalmente.
 *  2. Comparação com o banco: `compararComBancoColaboradores` — identifica
 *     cada pessoa como novo/atualização/sem alteração, sem gravar nada.
 *  3. Sincronização (Smart Sync): `sincronizarColaboradores` — grava no
 *     banco em lote dentro de uma transação: insere quem não existe,
 *     atualiza quem existe e mudou, e marca como "inativo" (nunca exclui)
 *     quem estava ativo no banco mas não apareceu neste arquivo.
 *
 * V6.1 — AJUSTE PÓS-ANÁLISE DA PLANILHA REAL: a coluna "Cadastro" do arquivo
 * oficial NÃO é matrícula/ID único — na prática lista as operadoras/clientes
 * atendidos pelo colaborador (ex.: "ERICSSON/NOKIA"), repete entre pessoas
 * diferentes e frequentemente vem vazia. Por isso ela vira apenas o campo
 * informativo `operadoras` e NÃO é mais usada para identificação. A chave
 * natural de deduplicação do Smart Sync passou a ser o NOME normalizado
 * (maiúsculas, sem acento, espaços colapsados) — não usamos CPF/RG como
 * identidade (proibido pela arquitetura V6).
 *
 * Também foi observado que, em parte das linhas, a coluna EmpresaNome vem
 * preenchida com "Nome da Pessoa + número de documento (tipo CPF)" em vez do
 * nome da empresa — normalmente colaboradores autônomos sem empresa formal.
 * `limparEmpresaNome` detecta esse padrão e descarta o número automaticamente
 * (o número nunca é gravado em lugar nenhum do sistema).
 */

export type StatusPrevisto = "novo" | "atualizacao" | "sem_alteracao";

export type ColaboradorImportado = {
  linha: number; // número da linha na planilha (1-based), só para mensagens
  nome: string;
  tipoPessoa: string | null;
  regional: string | null;
  operadoras: string | null;
  empresaNome: string | null;
  cargo: string | null;
  telefone: string | null;
  erros: string[];
  avisos: string[];
  // Preenchidos depois, por compararComBancoColaboradores:
  status?: StatusPrevisto;
  diferencas?: string[];
  idExistente?: number;
};

export type ResultadoAnaliseColaboradores = {
  arquivoNome: string;
  totalLinhas: number;
  pessoas: ColaboradorImportado[];
  novos: number;
  atualizacoes: number;
  semAlteracao: number;
  comErro: number;
  errosGlobais: string[];
  avisosGlobais: string[];
  podeConfirmar: boolean;
};

export type RelatorioSincronizacao = {
  novos: number;
  atualizados: number;
  mantidos: number;
  inativados: number;
  erros: number;
  tempoProcessamentoMs: number;
};

type CampoColaborador = "nome" | "tipoPessoa" | "regional" | "operadoras" | "empresaNome" | "cargo" | "telefone";

const ALIASES: Record<CampoColaborador, string[]> = {
  nome: ["nome", "nome completo", "colaborador", "funcionario", "funcionário"],
  tipoPessoa: ["tipopessoa", "tipo pessoa", "tipo", "vinculo", "vínculo", "regime"],
  regional: ["regional", "regiao", "região"],
  operadoras: ["cadastro", "operadoras", "operadora", "clientes", "operadoras/clientes", "operadoras clientes"],
  empresaNome: ["empresanome", "empresa", "empresa nome", "nome empresa", "razao social", "razão social"],
  cargo: ["cargo", "funcao", "função", "role", "posicao", "posição"],
  telefone: ["telefone", "telefone de contato", "contato", "celular", "whatsapp", "fone"],
};

const REGEX_DIACRITICOS = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), "g");

function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(REGEX_DIACRITICOS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Remove espaços extras preservando acentuação/capitalização originais do dado. */
function limparEspacos(valor: unknown): string {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function normalizarTipoPessoa(valor: unknown): string | null {
  const texto = limparEspacos(valor).toUpperCase();
  return texto || null;
}

function normalizarTelefone(valor: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 11) return `${digitos.slice(0, 2)} ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `${digitos.slice(0, 2)} ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return digitos;
}

function normalizarOperadoras(valor: unknown): string | null {
  const texto = limparEspacos(valor);
  return texto || null;
}

/**
 * Chave natural de deduplicação do Smart Sync: nome em maiúsculas, sem
 * acento, com espaços colapsados. Não há CPF/matrícula confiável na fonte
 * oficial (ver nota V6.1 no topo do arquivo), então o nome é o único dado
 * estável presente em 100% das linhas.
 */
export function calcularNomeNormalizado(nome: string): string {
  return normalizarTexto(nome).toUpperCase();
}

/**
 * Detecta e remove um número de documento (tipo CPF/RG, 8+ dígitos, com ou
 * sem pontuação) colado junto ao nome de campos "EmpresaNome" preenchidos
 * incorretamente com dados de pessoa física em vez de razão social.
 * Retorna `{ valor, limpou }` — `limpou` indica se algo foi removido, para
 * poder sinalizar um aviso na pré-visualização da importação.
 */
function limparEmpresaNome(valor: unknown): { valor: string | null; limpou: boolean } {
  const bruto = limparEspacos(valor);
  if (!bruto) return { valor: null, limpou: false };

  const comNumeroNoFim = bruto.match(/^(.*?\D)\s+[\d.\-/]{8,}$/);
  if (comNumeroNoFim) {
    const nomeLimpo = limparEspacos(comNumeroNoFim[1]);
    return { valor: nomeLimpo || null, limpou: true };
  }

  const comNumeroNoInicio = bruto.match(/^[\d.\-/]{6,}\s+(.+)$/);
  if (comNumeroNoInicio) {
    const nomeLimpo = limparEspacos(comNumeroNoInicio[1]);
    return { valor: nomeLimpo || null, limpou: true };
  }

  return { valor: bruto, limpou: false };
}

function localizarCabecalho(
  matriz: unknown[][]
): { linhaIndex: number; colunas: Partial<Record<CampoColaborador, number>> } | null {
  for (let i = 0; i < matriz.length; i++) {
    const linha = matriz[i];
    if (!linha) continue;
    const colunas: Partial<Record<CampoColaborador, number>> = {};
    for (let c = 0; c < linha.length; c++) {
      const textoCelula = normalizarTexto(linha[c]);
      if (!textoCelula) continue;
      for (const campo of Object.keys(ALIASES) as CampoColaborador[]) {
        if (colunas[campo] !== undefined) continue;
        if (ALIASES[campo].includes(textoCelula)) {
          colunas[campo] = c;
        }
      }
    }
    // Exige Nome + (Operadoras/Cadastro ou EmpresaNome) na mesma linha para
    // considerar cabeçalho válido da tabela de colaboradores.
    if (colunas.nome !== undefined && (colunas.operadoras !== undefined || colunas.empresaNome !== undefined)) {
      return { linhaIndex: i, colunas };
    }
  }
  return null;
}

/** Parsing puro: lê o buffer do Excel e devolve os colaboradores normalizados + validados (sem tocar no banco). */
export function analisarWorkbookColaboradores(buffer: Buffer, arquivoNome: string): ResultadoAnaliseColaboradores {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  let cabecalho: { linhaIndex: number; colunas: Partial<Record<CampoColaborador, number>> } | null = null;
  let matriz: unknown[][] = [];

  for (const nomeAba of workbook.SheetNames) {
    const sheet = workbook.Sheets[nomeAba];
    if (!sheet) continue;
    const matrizAba = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
    const achado = localizarCabecalho(matrizAba);
    if (achado) {
      cabecalho = achado;
      matriz = matrizAba;
      break;
    }
  }

  if (!cabecalho) {
    return {
      arquivoNome,
      totalLinhas: 0,
      pessoas: [],
      novos: 0,
      atualizacoes: 0,
      semAlteracao: 0,
      comErro: 0,
      errosGlobais: [
        "Não foi possível localizar a tabela de colaboradores na planilha (esperava colunas como Nome e Cadastro/EmpresaNome em alguma linha).",
      ],
      avisosGlobais: [],
      podeConfirmar: false,
    };
  }

  const { linhaIndex, colunas } = cabecalho;
  const pessoas: ColaboradorImportado[] = [];

  for (let i = linhaIndex + 1; i < matriz.length; i++) {
    const linha = matriz[i] ?? [];
    const nomeRaw = colunas.nome !== undefined ? linha[colunas.nome] : null;
    const nomeTexto = limparEspacos(nomeRaw);
    if (!nomeTexto) break; // fim da tabela: primeira linha sem Nome

    const tipoPessoaRaw = colunas.tipoPessoa !== undefined ? linha[colunas.tipoPessoa] : null;
    const regionalRaw = colunas.regional !== undefined ? linha[colunas.regional] : null;
    const operadorasRaw = colunas.operadoras !== undefined ? linha[colunas.operadoras] : null;
    const empresaNomeRaw = colunas.empresaNome !== undefined ? linha[colunas.empresaNome] : null;
    const cargoRaw = colunas.cargo !== undefined ? linha[colunas.cargo] : null;
    const telefoneRaw = colunas.telefone !== undefined ? linha[colunas.telefone] : null;

    const operadoras = normalizarOperadoras(operadorasRaw);
    const { valor: empresaNome, limpou: empresaNomeContinhaNumero } = limparEmpresaNome(empresaNomeRaw);
    const telefone = normalizarTelefone(telefoneRaw);

    const erros: string[] = [];
    const avisos: string[] = [];

    if (!regionalRaw) avisos.push("Regional não informada.");
    if (!empresaNome) avisos.push("Empresa não informada.");
    if (!cargoRaw) avisos.push("Cargo não informado.");
    if (!telefone) avisos.push("Telefone não informado.");
    if (!tipoPessoaRaw) avisos.push("TipoPessoa não informado.");
    if (empresaNomeContinhaNumero) {
      avisos.push("EmpresaNome continha um número de documento colado ao nome — removido automaticamente.");
    }

    pessoas.push({
      linha: i + 1,
      nome: nomeTexto,
      tipoPessoa: normalizarTipoPessoa(tipoPessoaRaw),
      regional: limparEspacos(regionalRaw) || null,
      operadoras,
      empresaNome,
      cargo: limparEspacos(cargoRaw) || null,
      telefone,
      erros,
      avisos,
    });
  }

  // Duplicidade dentro do próprio arquivo: mesmo nome normalizado em mais de
  // uma linha impede o Smart Sync de saber qual delas é a pessoa real —
  // como não há mais chave de fallback (cadastro não é confiável), essas
  // linhas ficam marcadas com erro e exigem correção manual na planilha.
  const porNomeNormalizado = new Map<string, number[]>();
  pessoas.forEach((p, idx) => {
    const chave = calcularNomeNormalizado(p.nome);
    const lista = porNomeNormalizado.get(chave) ?? [];
    lista.push(idx);
    porNomeNormalizado.set(chave, lista);
  });
  for (const indices of porNomeNormalizado.values()) {
    if (indices.length > 1) {
      const linhas = indices.map((idx) => pessoas[idx].linha).join(", ");
      for (const idx of indices) {
        pessoas[idx].erros.push(
          `Nome duplicado nesta planilha (linhas ${linhas}) — o Smart Sync identifica colaboradores pelo nome e não consegue diferenciar homônimos automaticamente. Ajuste o nome (ex.: adicione sobrenome completo) para diferenciar.`
        );
      }
    }
  }

  const errosGlobais: string[] = [];
  const avisosGlobais: string[] = [];
  if (pessoas.length === 0) {
    errosGlobais.push("Nenhum colaborador encontrado na planilha.");
  }

  const comErro = pessoas.filter((p) => p.erros.length > 0).length;
  const podeConfirmar = pessoas.length > 0 && comErro === 0;

  return {
    arquivoNome,
    totalLinhas: pessoas.length,
    pessoas,
    novos: 0,
    atualizacoes: 0,
    semAlteracao: 0,
    comErro,
    errosGlobais,
    avisosGlobais,
    podeConfirmar,
  };
}

type ColaboradorExistente = {
  id: number;
  nome: string;
  nomeNormalizado: string | null;
  tipoPessoa: string | null;
  regional: string | null;
  operadoras: string | null;
  empresaNome: string | null;
  cargo: string | null;
  telefone: string | null;
  status: string;
};

/** Busca todo o Cadastro Mestre atual e monta o índice de busca por nome normalizado. */
async function carregarIndices(): Promise<{
  porNomeNormalizado: Map<string, ColaboradorExistente>;
  todos: ColaboradorExistente[];
}> {
  const todos = await prisma.colaborador.findMany({
    select: {
      id: true,
      nome: true,
      nomeNormalizado: true,
      tipoPessoa: true,
      regional: true,
      operadoras: true,
      empresaNome: true,
      cargo: true,
      telefone: true,
      status: true,
    },
  });

  const porNomeNormalizado = new Map<string, ColaboradorExistente>();
  for (const c of todos) {
    const chave = c.nomeNormalizado ?? calcularNomeNormalizado(c.nome);
    porNomeNormalizado.set(chave, c);
  }

  return { porNomeNormalizado, todos };
}

function encontrarExistente(
  p: ColaboradorImportado,
  indices: { porNomeNormalizado: Map<string, ColaboradorExistente> }
): ColaboradorExistente | null {
  return indices.porNomeNormalizado.get(calcularNomeNormalizado(p.nome)) ?? null;
}

function calcularDiferencas(existente: ColaboradorExistente, p: ColaboradorImportado): string[] {
  const diffs: string[] = [];
  if (existente.nome !== p.nome) diffs.push("nome");
  if ((existente.tipoPessoa ?? null) !== p.tipoPessoa) diffs.push("tipoPessoa");
  if ((existente.regional ?? null) !== p.regional) diffs.push("regional");
  if ((existente.operadoras ?? null) !== p.operadoras) diffs.push("operadoras");
  if ((existente.empresaNome ?? null) !== p.empresaNome) diffs.push("empresaNome");
  if ((existente.cargo ?? null) !== p.cargo) diffs.push("cargo");
  if ((existente.telefone ?? null) !== p.telefone) diffs.push("telefone");
  if (existente.status !== "ativo") diffs.push("status (reativado)");
  return diffs;
}

/**
 * Cruza os colaboradores extraídos da planilha com o Cadastro Mestre atual
 * (por nome normalizado) para marcar cada um como "novo", "atualizacao" ou
 * "sem_alteracao". Não grava nada no banco.
 */
export async function compararComBancoColaboradores(
  pessoas: ColaboradorImportado[]
): Promise<ColaboradorImportado[]> {
  const indices = await carregarIndices();

  const comStatus = pessoas.map((p) => {
    if (p.erros.length > 0) return p;

    const existente = encontrarExistente(p, indices);
    if (!existente) {
      return { ...p, status: "novo" as StatusPrevisto };
    }
    const diferencas = calcularDiferencas(existente, p);
    return {
      ...p,
      status: (diferencas.length > 0 ? "atualizacao" : "sem_alteracao") as StatusPrevisto,
      diferencas: diferencas.length > 0 ? diferencas : undefined,
      idExistente: existente.id,
    };
  });

  return comStatus;
}

/**
 * SMART SYNC — grava a sincronização completa no banco:
 *  - Cria em lote (createMany) todo colaborador que não existia.
 *  - Atualiza individualmente (dentro da mesma transação) quem já existia e
 *    teve algum campo alterado, reativando quem estava inativo.
 *  - Marca como "inativo" (nunca exclui) todo colaborador que estava ativo
 *    no banco e não apareceu nesta planilha — preserva o histórico
 *    (avaliações, treinamentos, atendimentos) porque o registro continua
 *    existindo, só muda de status.
 *
 * Recebe apenas as linhas válidas (sem erro) já classificadas por
 * `compararComBancoColaboradores`. Roda em uma única transação com timeout
 * estendido para suportar milhares de registros.
 */
export async function sincronizarColaboradores(pessoas: ColaboradorImportado[]): Promise<RelatorioSincronizacao> {
  const inicio = Date.now();
  const validas = pessoas.filter((p) => p.erros.length === 0);
  const agora = new Date();

  const resultado = await prisma.$transaction(
    async (tx) => {
      const indices = await (async () => {
        const todos = await tx.colaborador.findMany({
          select: {
            id: true,
            nome: true,
            nomeNormalizado: true,
            tipoPessoa: true,
            regional: true,
            operadoras: true,
            empresaNome: true,
            cargo: true,
            telefone: true,
            status: true,
          },
        });
        const porNomeNormalizado = new Map<string, ColaboradorExistente>();
        for (const c of todos) {
          const chave = c.nomeNormalizado ?? calcularNomeNormalizado(c.nome);
          porNomeNormalizado.set(chave, c);
        }
        return { porNomeNormalizado };
      })();

      const idsMantidos = new Set<number>();
      const novos: typeof validas = [];
      let atualizados = 0;
      let mantidos = 0;

      for (const p of validas) {
        const existente = encontrarExistente(p, indices);
        if (!existente) {
          novos.push(p);
          continue;
        }

        idsMantidos.add(existente.id);
        const diferencas = calcularDiferencas(existente, p);
        if (diferencas.length > 0) {
          await tx.colaborador.update({
            where: { id: existente.id },
            data: {
              nome: p.nome,
              nomeNormalizado: calcularNomeNormalizado(p.nome),
              tipoPessoa: p.tipoPessoa,
              regional: p.regional,
              operadoras: p.operadoras,
              empresaNome: p.empresaNome,
              cargo: p.cargo,
              telefone: p.telefone,
              status: "ativo",
              dataImportacao: agora,
              ultimaAtualizacao: agora,
            },
          });
          atualizados++;
        } else {
          await tx.colaborador.update({
            where: { id: existente.id },
            data: { dataImportacao: agora },
          });
          mantidos++;
        }
      }

      // Inserção em lote dos colaboradores novos — evita N round-trips
      // individuais quando o arquivo traz centenas/milhares de admissões.
      if (novos.length > 0) {
        await tx.colaborador.createMany({
          data: novos.map((p) => ({
            nome: p.nome,
            nomeNormalizado: calcularNomeNormalizado(p.nome),
            tipoPessoa: p.tipoPessoa,
            regional: p.regional,
            operadoras: p.operadoras,
            empresaNome: p.empresaNome,
            cargo: p.cargo,
            telefone: p.telefone,
            status: "ativo",
            dataImportacao: agora,
            ultimaAtualizacao: agora,
          })),
          skipDuplicates: true,
        });
      }

      // Inativação em lote: quem estava ativo e não veio nesta planilha.
      const inativados = await tx.colaborador.updateMany({
        where: {
          status: "ativo",
          id: { notIn: Array.from(idsMantidos) },
        },
        data: { status: "inativo", ultimaAtualizacao: agora },
      });

      return {
        novos: novos.length,
        atualizados,
        mantidos,
        inativados: inativados.count,
      };
    },
    { timeout: 120_000 }
  );

  return {
    ...resultado,
    erros: pessoas.length - validas.length,
    tempoProcessamentoMs: Date.now() - inicio,
  };
}
