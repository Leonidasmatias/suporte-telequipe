type ScoreBarProps = {
  value: number;
  limiar?: number;
};

export default function ScoreBar({ value, limiar = 70 }: ScoreBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const cor = pct < limiar ? "bg-red-400" : pct < 85 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-xs font-medium text-slate-600">{Math.round(value)}%</span>
    </div>
  );
}
