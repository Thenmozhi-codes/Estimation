export function PageHeader({
  title,
  description,
  actions,
  children,
  breadcrumbs,
}) {
  return (
    <div className="bg-surface border-b border-line">
      <div className="page-container px-4 md:px-6">
        <div className="py-5 md:py-6">
          {breadcrumbs?.length > 0 && (
            <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-none whitespace-nowrap">
              {breadcrumbs.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {index > 0 && (
                    <span className="text-subtle">/</span>
                  )}

                  <span
                    className={
                      index === breadcrumbs.length - 1
                        ? "font-medium text-ink"
                        : "text-muted"
                    }
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[24px] md:text-[28px] leading-tight font-bold tracking-[-0.035em] text-ink">
                {title}
              </h1>

              {description && (
                <p className="mt-1.5 text-sm text-muted max-w-2xl">
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
      </div>
    </div>
  );
}