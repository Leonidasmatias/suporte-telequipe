import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildWhereSuporte } from "@/lib/suporte";
import { RECURSOS, verificarAcessoApi } from "@/lib/autorizacao";
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
 * query string).
 *
 * Etapa 3: única rota de API do sistema — protegida com o mesmo padrão
 * 401 (não autenticado) / 403 (autenticado sem permissão) usado em toda a
 * aplicação (ver lib/autorizacao.ts, verificarAcessoApi). Checagem
 * independente da UI: funciona mesmo que alguém chame a URL diretamente.
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
    const acessoNegado = await verificarAcessoApi(RECURSOS.exportacoes);
    if (acessoNegado) {
      return NextResponse.json(acessoNegado.body, { status: acessoNegado.status });
    }

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
      site: t.site,
      cliente: t.cliente,
      categoria: t.categoria,
      categoriaPrincipal: t.categoriaPrincipal,
      subcategoria: t.subcategoria,
      detalhamento: t.detalhamento,
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
