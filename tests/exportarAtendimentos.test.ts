import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";

// `lib/suporte.ts` importa `lib/prisma.ts`, que instancia um PrismaClient real
// no topo do módulo. Este arquivo de teste não usa banco nenhum (só a função
// pura `buildWhereSuporte`), então o cliente Prisma é substituído por um stub
// só para permitir o import — nenhuma consulta é de fato executada aqui.
vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));

const { buildWhereSuporte } = await import("@/lib/suporte");
import {
  validarFiltrosExportacao,
  sanitizarCelulaTexto,
  formatarDuracaoExportacao,
  formatarHoraExportacao,
  montarNomeArquivo,
  montarPeriodoSelecionado,
  montarLinhaPlanilha,
  calcularResumo,
  gerarWorkbookAtendimentos,
  COLUNAS_ATENDIMENTOS,
  type AtendimentoParaExportacao,
} from "@/lib/exportarAtendimentos";

function params(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj);
}

function ticket(overrides: Partial<AtendimentoParaExportacao> = {}): AtendimentoParaExportacao {
  return {
    numero: 1,
    dataAtendimento: new Date("2026-01-10T00:00:00Z"),
    horaInicio: "09:00",
    horaFim: "10:30",
    status: "Finalizado",
    colaboradorNome: "João da Silva",
    colaboradorTelefone: "11999990000",
    colaboradorRegional: "Sudeste",
    liderNomeHistorico: null,
    projeto: "Projeto Alfa",
    site: "SN-AQDIK4",
    cliente: "Cliente Alfa Telecom",
    categoria: "MOS",
    descricaoProblema: "Falha de sinal",
    tecnicoResponsavel: "Maria Souza",
    solucaoAplicada: "Reset de configuração",
    resultado: "Resolvido",
    tempoAtendimento: 90,
    observacoes: null,
    updatedAt: new Date("2026-01-10T13:05:00Z"),
    ...overrides,
  };
}

describe("validarFiltrosExportacao — exportação sem filtros", () => {
  it("query string vazia produz filtros vazios, sem erros (exporta tudo)", () => {
    const { filtros, erros } = validarFiltrosExportacao(params({}));
    expect(erros).toHaveLength(0);
    expect(filtros).toEqual({});
  });
});

describe("validarFiltrosExportacao — exportação com período", () => {
  it("aceita data_inicio e data_fim válidos (YYYY-MM-DD)", () => {
    const { filtros, erros } = validarFiltrosExportacao(
      params({ data_inicio: "2026-01-01", data_fim: "2026-01-31" })
    );
    expect(erros).toHaveLength(0);
    expect(filtros.dataInicio).toBe("2026-01-01");
    expect(filtros.dataFim).toBe("2026-01-31");
  });

  it("rejeita data malformada com mensagem de erro clara, sem quebrar", () => {
    const { filtros, erros } = validarFiltrosExportacao(params({ data_inicio: "31/01/2026" }));
    expect(erros.length).toBeGreaterThan(0);
    expect(filtros.dataInicio).toBeUndefined();
  });

  it("rejeita período invertido (início depois do fim)", () => {
    const { erros } = validarFiltrosExportacao(
      params({ data_inicio: "2026-02-01", data_fim: "2026-01-01" })
    );
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe("validarFiltrosExportacao — exportação por projeto", () => {
  it("aceita e sanitiza o filtro de projeto (texto livre)", () => {
    const { filtros, erros } = validarFiltrosExportacao(params({ projeto: "  Projeto Alfa  " }));
    expect(erros).toHaveLength(0);
    expect(filtros.projeto).toBe("Projeto Alfa");
  });

  it("descarta projeto vazio/só espaços em vez de aplicar filtro inválido", () => {
    const { filtros } = validarFiltrosExportacao(params({ projeto: "   " }));
    expect(filtros.projeto).toBeUndefined();
  });

  it("o where do Prisma reflete o filtro de projeto (contains, case-insensitive)", () => {
    const { filtros } = validarFiltrosExportacao(params({ projeto: "Alfa" }));
    const where = buildWhereSuporte(filtros);
    expect(JSON.stringify(where)).toContain("Alfa");
    expect(JSON.stringify(where)).toContain("insensitive");
  });
});

describe("validarFiltrosExportacao — exportação por status", () => {
  it("aceita um status da allowlist (STATUS_SUPORTE)", () => {
    const { filtros, erros } = validarFiltrosExportacao(params({ status: "Finalizado" }));
    expect(erros).toHaveLength(0);
    expect(filtros.status).toBe("Finalizado");
  });

  it("ignora silenciosamente um status fora da allowlist (nunca confia cegamente no frontend)", () => {
    const { filtros, erros } = validarFiltrosExportacao(params({ status: "status-forjado" }));
    expect(erros).toHaveLength(0);
    expect(filtros.status).toBeUndefined();
  });
});

describe("validarFiltrosExportacao — exportação com múltiplos filtros", () => {
  it("combina período + colaborador + categoria + status + técnico + busca corretamente", () => {
    const { filtros, erros } = validarFiltrosExportacao(
      params({
        data_inicio: "2026-01-01",
        data_fim: "2026-01-31",
        colaborador_id: "42",
        categoria: "SWAP",
        status: "Aberto",
        tecnico: "Carlos",
        busca: "torre",
      })
    );
    expect(erros).toHaveLength(0);
    expect(filtros).toEqual({
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31",
      colaboradorId: 42,
      categoria: "SWAP",
      status: "Aberto",
      tecnico: "Carlos",
      busca: "torre",
    });
  });

  it("um único campo inválido não descarta os demais filtros válidos", () => {
    const { filtros, erros } = validarFiltrosExportacao(
      params({ colaborador_id: "abc", categoria: "SWAP" })
    );
    expect(erros.length).toBeGreaterThan(0);
    expect(filtros.categoria).toBe("SWAP");
    expect(filtros.colaboradorId).toBeUndefined();
  });
});

describe("nenhum resultado", () => {
  it("calcularResumo com lista vazia não quebra e retorna zeros", () => {
    const resumo = calcularResumo([], {}, new Date("2026-01-15T12:00:00Z"));
    expect(resumo.totalAtendimentos).toBe(0);
    expect(resumo.totalResolvido).toBe(0);
    expect(resumo.totalPendente).toBe(0);
    expect(resumo.tempoMedioAtendimento).toBe("");
    expect(resumo.porProjeto).toEqual([]);
  });

  it("gerarWorkbookAtendimentos com lista vazia gera um workbook válido (só cabeçalho)", async () => {
    const buffer = await gerarWorkbookAtendimentos([], {}, new Date("2026-01-15T12:00:00Z"));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Buffer);
    const aba = wb.getWorksheet("Atendimentos")!;
    expect(aba.rowCount).toBe(2); // título + cabeçalho, nenhuma linha de dado
  });
});

describe("caracteres especiais", () => {
  it("acentuação, cedilha e símbolos comuns do português passam intactos", () => {
    const texto = "Torre não energizada — comunicação via rádio, ção/coração";
    expect(sanitizarCelulaTexto(texto)).toBe(texto);
  });

  it("aspas e caracteres de pontuação não são alterados quando não estão na primeira posição", () => {
    const texto = 'Cliente disse: "sem sinal" — 100% intermitente';
    expect(sanitizarCelulaTexto(texto)).toBe(texto);
  });

  it("o workbook gerado preserva caracteres especiais no round-trip real (grava e relê o .xlsx)", async () => {
    const t = ticket({ descricaoProblema: "Sinal instável — retorno em 24h, atenção à ção/não" });
    const buffer = await gerarWorkbookAtendimentos([t], {}, new Date("2026-01-15T12:00:00Z"));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Buffer);
    const aba = wb.getWorksheet("Atendimentos")!;
    const colDescricao = COLUNAS_ATENDIMENTOS.indexOf("Descrição") + 1;
    const valor = aba.getRow(3).getCell(colDescricao).value;
    expect(valor).toBe("Sinal instável — retorno em 24h, atenção à ção/não");
  });
});

describe("campos nulos", () => {
  it("sanitizarCelulaTexto nunca produz 'null', 'undefined' ou '[object Object]'", () => {
    expect(sanitizarCelulaTexto(null)).toBe("");
    expect(sanitizarCelulaTexto(undefined)).toBe("");
    expect(sanitizarCelulaTexto({ a: 1 })).toBe("");
    expect(sanitizarCelulaTexto([1, 2, 3])).toBe("");
  });

  it("formatarDuracaoExportacao trata tempoAtendimento nulo como string vazia, nunca 'null'", () => {
    expect(formatarDuracaoExportacao(null)).toBe("");
    expect(formatarDuracaoExportacao(undefined)).toBe("");
  });

  it("formatarHoraExportacao trata horaFim nula como string vazia", () => {
    expect(formatarHoraExportacao(null)).toBe("");
    expect(formatarHoraExportacao(undefined)).toBe("");
  });

  it("montarLinhaPlanilha com colaborador e liderNomeHistorico nulos não gera 'null'/'undefined' na linha", () => {
    const linha = montarLinhaPlanilha(
      ticket({
        colaboradorNome: null,
        liderNomeHistorico: null,
        colaboradorTelefone: null,
        colaboradorRegional: null,
        projeto: null,
        cliente: null,
        solucaoAplicada: null,
        observacoes: null,
        horaFim: null,
        tempoAtendimento: null,
        status: "Aberto",
      })
    );
    for (const valor of linha) {
      expect(String(valor)).not.toMatch(/null|undefined|\[object Object\]/i);
    }
  });

  it("data/hora de encerramento ficam em branco quando o atendimento não está finalizado", () => {
    const linha = montarLinhaPlanilha(ticket({ status: "Aberto" }));
    const idxDataEncerramento = COLUNAS_ATENDIMENTOS.indexOf("Data de encerramento");
    const idxHoraEncerramento = COLUNAS_ATENDIMENTOS.indexOf("Hora de encerramento");
    expect(linha[idxDataEncerramento]).toBe("");
    expect(linha[idxHoraEncerramento]).toBe("");
  });
});

describe("proteção contra fórmulas em células", () => {
  it.each(["=SOMA(A1:A9)", "+1+1", "-1+1", "@SUM(1,2)"])(
    "prefixa apóstrofo quando o texto começa com gatilho de fórmula: %s",
    (malicioso) => {
      const resultado = sanitizarCelulaTexto(malicioso);
      expect(resultado.startsWith("'")).toBe(true);
      expect(resultado).toBe(`'${malicioso}`);
    }
  );

  it("não prefixa quando o gatilho não está na primeira posição", () => {
    expect(sanitizarCelulaTexto("Total: =SOMA(A1:A9)")).toBe("Total: =SOMA(A1:A9)");
  });

  it("descrição/solução/observações maliciosas são neutralizadas de ponta a ponta na linha da planilha", () => {
    const linha = montarLinhaPlanilha(
      ticket({
        descricaoProblema: "=cmd|'/c calc'!A1",
        solucaoAplicada: "+HYPERLINK(\"http://evil\")",
        observacoes: "@import(malware)",
      })
    );
    const idxDescricao = COLUNAS_ATENDIMENTOS.indexOf("Descrição");
    const idxSolucao = COLUNAS_ATENDIMENTOS.indexOf("Solução aplicada");
    const idxObs = COLUNAS_ATENDIMENTOS.indexOf("Observações");
    expect(String(linha[idxDescricao]).startsWith("'")).toBe(true);
    expect(String(linha[idxSolucao]).startsWith("'")).toBe(true);
    expect(String(linha[idxObs]).startsWith("'")).toBe(true);
  });

  it("o valor gravado no .xlsx real fica como texto literal (apóstrofo), nunca como fórmula executável", async () => {
    const t = ticket({ observacoes: "=1+1" });
    const buffer = await gerarWorkbookAtendimentos([t], {}, new Date("2026-01-15T12:00:00Z"));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Buffer);
    const aba = wb.getWorksheet("Atendimentos")!;
    const colObs = COLUNAS_ATENDIMENTOS.indexOf("Observações") + 1;
    const celula = aba.getRow(3).getCell(colObs);
    // Nunca deve ter sido interpretada como fórmula (o exceljs marcaria formula !== undefined nesse caso).
    expect(celula.formula).toBeUndefined();
    expect(String(celula.value)).toBe("'=1+1");
  });
});

describe("cálculo correto do resumo", () => {
  const tickets: AtendimentoParaExportacao[] = [
    ticket({ resultado: "Resolvido", status: "Finalizado", tempoAtendimento: 60, projeto: "Alfa", categoria: "MOS", colaboradorRegional: "Sudeste", tecnicoResponsavel: "Maria" }),
    ticket({ resultado: "Resolvido", status: "Finalizado", tempoAtendimento: 30, projeto: "Alfa", categoria: "XML", colaboradorRegional: "Sudeste", tecnicoResponsavel: "Maria" }),
    ticket({ resultado: "Resolvido Parcialmente", status: "Em Atendimento", tempoAtendimento: 120, projeto: "Beta", categoria: "MOS", colaboradorRegional: "Sul", tecnicoResponsavel: "Carlos" }),
    ticket({ resultado: "Cancelado", status: "Finalizado", tempoAtendimento: null, projeto: "Beta", categoria: "SWAP", colaboradorRegional: null, tecnicoResponsavel: null }),
    ticket({ resultado: "Aguardando Cliente", status: "Aberto", tempoAtendimento: 15, projeto: null, categoria: "MOS", colaboradorRegional: "Sul", tecnicoResponsavel: "Carlos" }),
  ];

  it("totaliza atendimentos, resolvidos, parciais, não resolvidos e pendentes corretamente", () => {
    const resumo = calcularResumo(tickets, {}, new Date("2026-01-15T12:00:00Z"));
    expect(resumo.totalAtendimentos).toBe(5);
    expect(resumo.totalResolvido).toBe(2);
    expect(resumo.totalResolvidoParcial).toBe(1);
    expect(resumo.totalNaoResolvido).toBe(2); // Cancelado + Aguardando Cliente
    expect(resumo.totalPendente).toBe(2); // status !== Finalizado: Em Atendimento + Aberto
  });

  it("calcula o tempo médio de atendimento só sobre os tickets com tempo conhecido", () => {
    // (60 + 30 + 120 + 15) / 4 = 56.25 -> arredonda para 56min = "56min"
    const resumo = calcularResumo(tickets, {}, new Date("2026-01-15T12:00:00Z"));
    expect(resumo.tempoMedioAtendimento).toBe("56min");
  });

  it("agrupa quantidade por projeto, categoria, regional e técnico responsável, ordenado por quantidade desc", () => {
    const resumo = calcularResumo(tickets, {}, new Date("2026-01-15T12:00:00Z"));
    expect(resumo.porProjeto).toEqual([
      { nome: "Alfa", quantidade: 2 },
      { nome: "Beta", quantidade: 2 },
      { nome: "Sem projeto", quantidade: 1 },
    ]);
    expect(resumo.porCategoria[0]).toEqual({ nome: "MOS", quantidade: 3 });
    expect(resumo.porRegional.find((r) => r.nome === "Sem regional")?.quantidade).toBe(1);
    expect(resumo.porTecnico.find((t) => t.nome === "Maria")?.quantidade).toBe(2);
  });

  it("período selecionado reflete o filtro (ambos, só início, só fim, nenhum)", () => {
    expect(montarPeriodoSelecionado({ dataInicio: "2026-01-01", dataFim: "2026-01-31" })).toBe(
      "01/01/2026 a 31/01/2026"
    );
    expect(montarPeriodoSelecionado({ dataInicio: "2026-01-01" })).toBe("A partir de 01/01/2026");
    expect(montarPeriodoSelecionado({ dataFim: "2026-01-31" })).toBe("Até 31/01/2026");
    expect(montarPeriodoSelecionado({})).toBe("Todos os períodos");
  });
});

describe("nome do arquivo", () => {
  const agora = new Date("2026-03-05T18:00:00Z");

  it("usa a data de geração quando não há filtro de período", () => {
    expect(montarNomeArquivo({}, agora)).toBe("relatorio-atendimentos-2026-03-05.xlsx");
  });

  it("usa o intervalo do filtro quando início E fim estão presentes", () => {
    expect(montarNomeArquivo({ dataInicio: "2026-01-01", dataFim: "2026-01-31" }, agora)).toBe(
      "relatorio-atendimentos-2026-01-01-a-2026-01-31.xlsx"
    );
  });

  it("cai no padrão de data única quando só um dos dois limites do período está presente", () => {
    expect(montarNomeArquivo({ dataInicio: "2026-01-01" }, agora)).toBe(
      "relatorio-atendimentos-2026-03-05.xlsx"
    );
  });
});

describe("formatação de duração e hora", () => {
  it("formatarDuracaoExportacao produz o estilo '2h17min' pedido", () => {
    expect(formatarDuracaoExportacao(137)).toBe("2h17min");
    expect(formatarDuracaoExportacao(45)).toBe("45min");
    expect(formatarDuracaoExportacao(0)).toBe("0min");
  });

  it("formatarHoraExportacao normaliza para HH:mm com dois dígitos", () => {
    expect(formatarHoraExportacao("9:05")).toBe("09:05");
    expect(formatarHoraExportacao("14:30")).toBe("14:30");
    expect(formatarHoraExportacao("25:00")).toBe(""); // hora inválida
  });
});

describe("validarFiltrosExportacao — exportação por site", () => {
  it("aceita e sanitiza o filtro de site (texto livre, mesmo tratamento de projeto/técnico)", () => {
    const { filtros, erros } = validarFiltrosExportacao(params({ site: "  SN-AQDIK4  " }));
    expect(erros).toHaveLength(0);
    expect(filtros.site).toBe("SN-AQDIK4");
  });

  it("o where do Prisma reflete o filtro de site (contains, case-insensitive)", () => {
    const { filtros } = validarFiltrosExportacao(params({ site: "AQDIK4" }));
    const where = buildWhereSuporte(filtros);
    expect(JSON.stringify(where)).toContain("AQDIK4");
    expect(JSON.stringify(where)).toContain("insensitive");
  });
});

describe("coluna SITE na exportação Excel", () => {
  it("todas as colunas anteriores são preservadas, na mesma ordem, mais a nova coluna Site e a renomeação Site→Cliente", () => {
    // Regressão explícita: a única mudança estrutural desta planilha é a
    // inserção de "Site" (dado novo, campo SupportTicket.site) logo após
    // "Projeto", e a coluna que antes se chamava "Site" (mas já mostrava o
    // campo `cliente`) passou a se chamar "Cliente" — mesma posição, mesmo
    // dado, só o rótulo mudou para refletir o que ela sempre mostrou.
    // Nenhuma outra coluna, nome ou posição foi alterada.
    expect(COLUNAS_ATENDIMENTOS).toEqual([
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
      "Categoria",
      "Descrição",
      "Técnico responsável",
      "Solução aplicada",
      "Resultado",
      "Status",
      "Tempo de atendimento",
      "Observações",
    ]);
  });

  it("montarLinhaPlanilha preenche a coluna Site com o site do atendimento", () => {
    const linha = montarLinhaPlanilha(ticket({ site: "SN-AQDIK4" }));
    const idxSite = COLUNAS_ATENDIMENTOS.indexOf("Site");
    expect(linha[idxSite]).toBe("SN-AQDIK4");
  });

  it("montarLinhaPlanilha preenche a coluna Cliente com o mesmo dado de sempre (campo cliente, comportamento inalterado)", () => {
    const linha = montarLinhaPlanilha(ticket({ cliente: "Cliente Alfa Telecom" }));
    const idxCliente = COLUNAS_ATENDIMENTOS.indexOf("Cliente");
    expect(linha[idxCliente]).toBe("Cliente Alfa Telecom");
  });

  it("atendimento sem site (antigo ou administrativo) deixa a célula Site vazia, sem quebrar a exportação", () => {
    const linha = montarLinhaPlanilha(ticket({ site: null }));
    const idxSite = COLUNAS_ATENDIMENTOS.indexOf("Site");
    expect(linha[idxSite]).toBe("");
  });

  it("o arquivo .xlsx real tem a coluna Site preenchida corretamente (round-trip)", async () => {
    const t = ticket({ site: "SN-AQDIK4" });
    const buffer = await gerarWorkbookAtendimentos([t], {}, new Date("2026-01-15T12:00:00Z"));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Buffer);
    const aba = wb.getWorksheet("Atendimentos")!;
    const colSite = COLUNAS_ATENDIMENTOS.indexOf("Site") + 1;
    expect(aba.getRow(2).getCell(colSite).value).toBe("Site"); // cabeçalho
    expect(aba.getRow(3).getCell(colSite).value).toBe("SN-AQDIK4"); // dado
  });

  it("exportação de um atendimento antigo sem site preserva todas as demais colunas normalmente", async () => {
    const t = ticket({ site: null, projeto: "Projeto Alfa", cliente: "Cliente Alfa Telecom" });
    const buffer = await gerarWorkbookAtendimentos([t], {}, new Date("2026-01-15T12:00:00Z"));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as Buffer);
    const aba = wb.getWorksheet("Atendimentos")!;
    const linhaDado = aba.getRow(3);
    expect(linhaDado.getCell(COLUNAS_ATENDIMENTOS.indexOf("Site") + 1).value).toBe("");
    expect(linhaDado.getCell(COLUNAS_ATENDIMENTOS.indexOf("Projeto") + 1).value).toBe("Projeto Alfa");
    expect(linhaDado.getCell(COLUNAS_ATENDIMENTOS.indexOf("Cliente") + 1).value).toBe("Cliente Alfa Telecom");
  });
});
