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
 * Não usamos CPF/RG como identidade (proibido pela nova arquitetura). A
 * chave natural de deduplicação é `cadastro` (matrícula, estável e única
 * por decisão do usuário); quando um registro não tem `cadastro`, cai-se
 * para uma chave composta Nome + EmpresaNome + Telefone normalizados.
 */

export type StatusPrevisto = "novo" | "atualizacao" | "sem_alteracao";

export type ColaboradorImportado = {
  linha: number; // número da linha na planilha (1-based), só para mensagens
  nome: string;
  tipoPessoa: string | null;
  regional: string | null;
  cadastro: string | null;
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

type CampoColaborador = "nome" | "tipoPessoa" | "regional" | "cadastro" | "empresaNome" | "cargo" | "telefone";

const ALIASES: Record<CampoColaborador, string[]> = {
  nome: ["nome", "nome completo", "colaborador", "funcionario", "funcionário"],
  tipoPessoa: ["tipopessoa", "tipo pessoa", "tipo", "vinculo", "vínculo", "regime"],
  regional: ["regional", "regiao", "região"],
  cadastro: ["cadastro", "matricula", "matrícula", "codigo", "código", "registro"],
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

function apenasDigitos(valor: string | null | undefined): string {
  return String(valor ?? "").replace(/\D/g, "");
}

/** Chave composta de fallback quando não há `cadastro`: nome + empresa + telefone normalizados. */
function chaveComposta(nome: string, empresaNome: string | null, telefone: string | null): string {
  return [normalizarTexto(nome), normalizarTexto(empresaNome), apenasDigitos(telefone)].join("|");
}

function normalizarCadastro(valor: unknown): string | null {
  const texto = limparEspacos(valor);
  return texto || null;
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
    // Exige Nome + (Cadastro ou EmpresaNome) na mesma linha para considerar
    // cabeçalho válido da tabela de colaboradores.
    if (colunas.nome !== undefined && (colunas.cadastro !== undefined || colunas.empresaNome !== undefined)) {
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
    const cadastroRaw = colunas.cadastro !== undefined ? linha[colunas.cadastro] : null;
    const empresaNomeRaw = colunas.empresaNome !== undefined ? linha[colunas.empresaNome] : null;
    const cargoRaw = colunas.cargo !== undefined ? linha[colunas.cargo] : null;
    const telefoneRaw = colunas.telefone !== undefined ? linha[colunas.telefone] : null;

    const cadastro = normalizarCadastro(cadastroRaw);
    const empresaNome = limparEspacos(empresaNomeRaw) || null;
    const telefone = normalizarTelefone(telefoneRaw);

    const erros: string[] = [];
    const avisos: string[] = [];

    if (!cadastro) {
      avisos.push("Cadastro não informado — identificação usará Nome + Empresa + Telefone (menos confiável).");
    }
    if (!regionalRaw) avisos.push("Regional não informada.");
    if (!empresaNome) avisos.push("Empresa não informada.");
    if (!cargoRaw) avisos.push("Cargo não informado.");
    if (!telefone) avisos.push("Telefone não informado.");
    if (!tipoPessoaRaw) avisos.push("TipoPessoa não informado.");

    pessoas.push({
      linha: i + 1,
      nome: nomeTexto,
      tipoPessoa: normalizarTipoPessoa(tipoPessoaRaw),
      regional: limparEspacos(regionalRaw) || null,
      cadastro,
      empresaNome,
      cargo: limparEspacos(cargoRaw) || null,
      telefone,
      erros,
      avisos,
    });
  }

  // Duplicidade dentro do próprio arquivo: por Cadastro (quando informado) e,
  // para quem não tem Cadastro, pela chave composta Nome+Empresa+Telefone.
  const porCadastro = new Map<string, number[]>();
  const porChaveComposta = new Map<string, number[]>();
  pessoas.forEach((p, idx) => {
    if (p.cadastro) {
      const lista = porCadastro.get(p.cadastro) ?? [];
      lista.push(idx);
      porCadastro.set(p.cadastro, lista);
    } else {
      const chave = chaveComposta(p.nome, p.empresaNome, p.telefone);
      const lista = porChaveComposta.get(chave) ?? [];
      lista.push(idx);
      porChaveComposta.set(chave, lista);
    }
  });
  for (const indices of porCadastro.values()) {
    if (indices.length > 1) {
      const linhas = indices.map((idx) => pessoas[idx].linha).join(", ");
      for (const idx of indices) pessoas[idx].erros.push(`Cadastro duplicado nesta planilha (linhas ${linhas}).`);
    }
  }
  for (const indices of porChaveComposta.values()) {
    if (indices.length > 1) {
      const linhas = indices.map((idx) => pessoas[idx].linha).join(", ");
      for (const idx of indices) {
        pessoas[idx].erros.push(
          `Sem Cadastro, e Nome + Empresa + Telefone coincidem com outra linha desta planilha (linhas ${linhas}) — não é possível identificar com segurança.`
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
  tipoPessoa: string | null;
  regional: string | null;
  cadastro: string | null;
  empresaNome: string | null;
  cargo: string | null;
  telefone: string | null;
  status: string;
};

/** Busca todo o Cadastro Mestre atual e monta os índices de busca (por cadastro e por chave composta). */
async function carregarIndices(): Promise<{
  porCadastro: Map<string, ColaboradorExistente>;
  porChaveComposta: Map<string, ColaboradorExistente>;
  todos: ColaboradorExistente[];
}> {
  const todos = await prisma.colaborador.findMany({
    select: {
      id: true,
      nome: true,
      tipoPessoa: true,
      regional: true,
      cadastro: true,
      empresaNome: true,
      cargo: true,
      telefone: true,
      status: true,
    },
  });

  const porCadastro = new Map<string, ColaboradorExistente>();
  const porChaveComposta = new Map<string, ColaboradorExistente>();
  for (const c of todos) {
    if (c.cadastro) porCadastro.set(c.cadastro, c);
    else porChaveComposta.set(chaveComposta(c.nome, c.empresaNome, c.telefone), c);
  }

  return { porCadastro, porChaveComposta, todos };
}

function encontrarExistente(
  p: ColaboradorImportado,
  indices: { porCadastro: Map<string, ColaboradorExistente>; porChaveComposta: Map<string, ColaboradorExistente> }
): ColaboradorExistente | null {
  if (p.cadastro) {
    const achado = indices.porCadastro.get(p.cadastro);
    if (achado) return achado;
  }
  const achadoComposto = indices.porChaveComposta.get(chaveComposta(p.nome, p.empresaNome, p.telefone));
  return achadoComposto ?? null;
}

function calcularDiferencas(existente: ColaboradorExistente, p: ColaboradorImportado): string[] {
  const diffs: string[] = [];
  if (existente.nome !== p.nome) diffs.push("nome");
  if ((existente.tipoPessoa ?? null) !== p.tipoPessoa) diffs.push("tipoPessoa");
  if ((existente.regional ?? null) !== p.regional) diffs.push("regional");
  if ((existente.empresaNome ?? null) !== p.empresaNome) diffs.push("empresaNome");
  if ((existente.cargo ?? null) !== p.cargo) diffs.push("cargo");
  if ((existente.telefone ?? null) !== p.telefone) diffs.push("telefone");
  if (existente.status !== "ativo") diffs.push("status (reativado)");
  return diffs;
}

/**
 * Cruza os colaboradores extraídos da planilha com o Cadastro Mestre atual
 * (por Cadastro, com fallback por Nome+Empresa+Telefone) para marcar cada um
 * como "novo", "atualizacao" ou "sem_alteracao". Não grava nada no banco.
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
            tipoPessoa: true,
            regional: true,
            cadastro: true,
            empresaNome: true,
            cargo: true,
            telefone: true,
            status: true,
          },
        });
        const porCadastro = new Map<string, ColaboradorExistente>();
        const porChaveComposta = new Map<string, ColaboradorExistente>();
        for (const c of todos) {
          if (c.cadastro) porCadastro.set(c.cadastro, c);
          else porChaveComposta.set(chaveComposta(c.nome, c.empresaNome, c.telefone), c);
        }
        return { porCadastro, porChaveComposta };
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
              tipoPessoa: p.tipoPessoa,
              regional: p.regional,
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
            tipoPessoa: p.tipoPessoa,
            regional: p.regional,
            cadastro: p.cadastro,
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
