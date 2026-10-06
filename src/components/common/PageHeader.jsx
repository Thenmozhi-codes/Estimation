export function PageHeader({ title, description, count, actions, children, breadcrumbs }) {
  return (
    <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3.5 border-b border-line bg-surface">
      {breadcrumbs && (
        <div className="text-2xs text-muted mb-2 flex items-center gap-1.5">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-40">/</span>}
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? "text-ink font-medium"
                    : ""
                }
              >
                {b}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-ink truncate">
            {title}
          </h1>

          {(count != null || description) && (
            <p className="text-xs md:text-sm text-muted mt-0.5">
              {count != null && (
                <span className="font-medium text-ink/70">{count} total</span>
              )}
              {count != null && description && <span className="mx-1.5">·</span>}
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}