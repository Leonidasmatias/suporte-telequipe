type ScoreBarProps = {
  value: number;
  limiar?: number;
};

export default function ScoreBar({ value, limiar = 70 }: ScoreBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const cor = pct < limiar ? "bg-red-500" : pct < 85 ? "bg-amber-400" : "bg-neon-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-graphite-700">
        <div
          className={`h-full rounded-full ${cor} transition-[width] duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 text-xs font-medium tabular-nums text-graphite-300">{Math.round(value)}%</span>
    </div>
  );
}
