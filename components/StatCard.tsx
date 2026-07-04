type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "brand" | "green" | "amber" | "slate";
};

const accentMap: Record<string, string> = {
  brand: "text-brand-600 bg-brand-50",
  green: "text-emerald-600 bg-emerald-50",
  amber: "text-amber-600 bg-amber-50",
  slate: "text-slate-600 bg-slate-100",
};

export default function StatCard({ label, value, hint, accent = "brand" }: StatCardProps) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-lg px-2 py-1 text-3xl font-semibold ${accentMap[accent]}`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
