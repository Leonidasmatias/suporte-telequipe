export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-graphite-700 bg-graphite-900/40 py-14 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mb-3 h-8 w-8 text-graphite-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6-4h6m2 12H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm text-graphite-500">{message}</p>
    </div>
  );
}
