export function PageHeader({ title, description, actions, children, breadcrumbs }) {
  return (
    <div className="px-4 md:px-6 pt-5 md:pt-6 pb-4 border-b border-line bg-surface">
      {breadcrumbs && (
        <div className="text-2xs text-muted mb-2 flex items-center gap-1.5">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-40">/</span>}
              <span className={i === breadcrumbs.length - 1 ? "text-ink font-medium" : ""}>
                {b}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs md:text-sm text-muted mt-1">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}