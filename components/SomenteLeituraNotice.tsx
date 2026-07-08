export default function SomenteLeituraNotice({ mensagem }: { mensagem?: string }) {
  return (
    <div className="card border-graphite-700 bg-graphite-900/40 text-center">
      <p className="text-sm text-graphite-400">
        {mensagem ?? "Modo de visualização — destrave a edição na barra lateral para alterar dados."}
      </p>
    </div>
  );
}
