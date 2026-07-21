import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildWhereSuporte } from "@/lib/suporte";
import {
  validarFiltrosExportacao,
  montarNomeArquivo,
  gerarWorkbookAtendimentos,
  type AtendimentoParaExportacao,
} from "@/lib/exportarAtendimentos";

/**
 * GET /suporte/exportar?<mesmos parâmetros de query de /suporte>
 *
 * Exportação em Excel (.xlsx) dos atendimentos da tela "Suporte Técnico",
 * respeitando exatamente os filtros atualmente aplicados na tela (mesma
 * query string). É uma operação de leitura — mesma política de acesso da
 * própria listagem /suporte (visualização livre; só escrita exige o "modo de
 * edição" — ver `lib/auth.ts`), então não exige `garantirModoEdicao()`.
 *
 * Os filtros nunca são confiados como vieram do frontend: são revalidados e
 * saneados aqui (`validarFiltrosExportacao`) antes de qualquer consulta —
 * mesmo que um usuário monte a URL manualmente. Sem filtro nenhum, exporta a
 * base inteira (mesma regra da listagem em tela). Sem paginação: busca todos
 * os registros que atendem à consulta, nunca só "a página atual" (a própria
 * tela /suporte também não pagina hoje).
 */
export async function GET(request: NextRequest) {
  try {
    const { filtros, erros } = validarFiltrosExportacao(request.nextUrl.searchParams);
    if (erros.length > 0) {
      return NextResponse.json({ ok: false, error: erros.join(" ") }, { status: 400 });
    }

    const ticketsRaw = await prisma.supportTicket.findMany({
      where: buildWhereSuporte(filtros),
      include: { colaborador: true },
      orderBy: { dataAtendimento: "desc" },
    });

    if (ticketsRaw.length === 0) {
      return NextResponse.json({ ok: true, empty: true });
    }

    type TicketComColaborador = Prisma.SupportTicketGetPayload<{ include: { colaborador: true } }>;
    const tickets: AtendimentoParaExportacao[] = ticketsRaw.map((t: TicketComColaborador) => ({
      numero: t.numero,
      dataAtendimento: t.dataAtendimento,
      horaInicio: t.horaInicio,
      horaFim: t.horaFim,
      status: t.status,
      colaboradorNome: t.colaborador?.nome ?? null,
      colaboradorTelefone: t.colaborador?.telefone ?? null,
      colaboradorRegional: t.colaborador?.regional ?? null,
      liderNomeHistorico: t.liderNomeHistorico,
      projeto: t.projeto,
      cliente: t.cliente,
      categoria: t.categoria,
      descricaoProblema: t.descricaoProblema,
      tecnicoResponsavel: t.tecnicoResponsavel,
      solucaoAplicada: t.solucaoAplicada,
      resultado: t.resultado,
      tempoAtendimento: t.tempoAtendimento,
      observacoes: t.observacoes,
      updatedAt: t.updatedAt,
    }));

    const agora = new Date();
    const buffer = await gerarWorkbookAtendimentos(tickets, filtros, agora);
    const nomeArquivo = montarNomeArquivo(filtros, agora);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": String(buffer.byteLength),
        "X-Total-Atendimentos": String(tickets.length),
      },
    });
  } catch {
    // Nunca expõe detalhes internos (mensagem de erro do Prisma, stack, etc.) na resposta.
    return NextResponse.json(
      { ok: false, error: "Não foi possível gerar o relatório. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
