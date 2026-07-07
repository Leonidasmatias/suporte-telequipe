type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-graphite-800 pb-5 animate-slide-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-graphite-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}
