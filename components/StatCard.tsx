type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "brand" | "green" | "amber" | "slate";
};

const accentMap: Record<string, string> = {
  brand: "text-neon-500 bg-neon-50",
  green: "text-emerald-600 bg-emerald-50",
  amber: "text-amber-600 bg-amber-50",
  slate: "text-graphite-300 bg-graphite-950",
};

export default function StatCard({ label, value, hint, accent = "brand" }: StatCardProps) {
  return (
    <div className="card transition-shadow duration-200 hover:shadow-panel">
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
