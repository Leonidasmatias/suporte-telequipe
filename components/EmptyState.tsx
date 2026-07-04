export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
