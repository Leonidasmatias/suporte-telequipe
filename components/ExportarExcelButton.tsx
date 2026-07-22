"use client";

import { useState } from "react";

type Estado = "ocioso" | "gerando" | "sucesso" | "vazio" | "erro";

const MENSAGENS: Record<Estado, string | null> = {
  ocioso: null,
  gerando: "Gerando relatório...",
  sucesso: "Relatório Excel gerado com sucesso.",
  vazio: "Nenhum atendimento encontrado para os filtros selecionados.",
  erro: null, // mensagem específica fica em `mensagemErro`
};

const ESTILO_MENSAGEM: Record<Estado, string> = {
  ocioso: "",
  gerando: "text-graphite-400",
  sucesso: "text-emerald-600",
  vazio: "text-graphite-400",
  erro: "text-red-600",
};

/**
 * Botão "Exportar Excel" da tela /suporte. Recebe a query string atual da
 * página (mesmos filtros aplicados na listagem) e busca o arquivo em
 * `/suporte/exportar`, sempre com os mesmos parâmetros — a exportação nunca
 * fica dessincronizada dos filtros visíveis em tela.
 *
 * Download 100% client-side via Blob (sem navegação de página) para poder
 * mostrar os estados de feedback pedidos ("Gerando relatório...", sucesso,
 * vazio, erro) sem interromper a tela atual.
 */
export default function ExportarExcelButton({ queryString }: { queryString: string }) {
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  async function handleExportar() {
    setEstado("gerando");
    setMensagemErro(null);
    try {
      const resposta = await fetch(`/suporte/exportar${queryString ? `?${queryString}` : ""}`);
      const tipoConteudo = resposta.headers.get("Content-Type") ?? "";

      if (tipoConteudo.includes("spreadsheetml")) {
        const blob = await resposta.blob();
        const nomeArquivo = extrairNomeArquivo(resposta.headers.get("Content-Disposition"));
        dispararDownload(blob, nomeArquivo);
        setEstado("sucesso");
        return;
      }

      const corpo = await resposta.json().catch(() => null);
      if (resposta.ok && corpo?.empty) {
        setEstado("vazio");
        return;
      }
      setMensagemErro(corpo?.error || "Não foi possível gerar o relatório. Tente novamente.");
      setEstado("erro");
    } catch {
      setMensagemErro("Falha de conexão ao gerar o relatório. Tente novamente.");
      setEstado("erro");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleExportar}
        disabled={estado === "gerando"}
        className="btn-secondary inline-flex items-center gap-1.5"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2-9H8a2 2 0 00-2 2v14a2 2 0 002 2h9a2 2 0 002-2V8l-5-5z" />
        </svg>
        {estado === "gerando" ? "Gerando relatório..." : "Exportar Excel"}
      </button>
      {(MENSAGENS[estado] || mensagemErro) && (
        <p className={`text-xs ${ESTILO_MENSAGEM[estado]}`}>{estado === "erro" ? mensagemErro : MENSAGENS[estado]}</p>
      )}
    </div>
  );
}

function extrairNomeArquivo(cabecalho: string | null): string {
  const padrao = "relatorio-atendimentos.xlsx";
  if (!cabecalho) return padrao;
  const m = cabecalho.match(/filename="([^"]+)"/);
  return m?.[1] || padrao;
}

function dispararDownload(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
