type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "brand" | "green" | "amber" | "slate";
};

const accentMap: Record<string, string> = {
  brand: "text-neon-400 bg-neon-500/10",
  green: "text-neon-400 bg-neon-500/10",
  amber: "text-amber-400 bg-amber-500/10",
  slate: "text-graphite-200 bg-graphite-700/60",
};

export default function StatCard({ label, value, hint, accent = "brand" }: StatCardProps) {
  return (
    <div className="card transition-colors duration-150 hover:border-graphite-600">
      <p className="text-xs font-medium uppercase tracking-wide text-graphite-400">{label}</p>
      <p
        className={`mt-2 inline-flex rounded-lg px-2 py-1 text-3xl font-semibold tabular-nums ${accentMap[accent]}`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-graphite-500">{hint}</p>}
    </div>
  );
}
