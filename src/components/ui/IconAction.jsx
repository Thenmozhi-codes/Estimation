import { cn } from "@/lib/utils/cn";

/* Quiet by default (all icons share one soft grey) — the colour only shows on
   hover, so a row of actions never looks like a rainbow. */
const TONES = {
  slate: "text-slate-400 hover:bg-slate-500/10 hover:text-ink",
  primary: "text-slate-400 hover:bg-primary-500/10 hover:text-primary-600",
  sky: "text-slate-400 hover:bg-sky-500/10 hover:text-sky-600",
  emerald: "text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-600",
  red: "text-slate-400 hover:bg-red-500/10 hover:text-red-500",
};

/* Small icon-only button for table rows (has a tooltip + screen-reader name) */
export function IconAction({ icon: Icon, label, tone = "slate", onClick, badge }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      className={cn(
        "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
        TONES[tone],
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />

      {/* count badge stays INSIDE the button, so it never touches the next icon */}
      {badge ? (
        <span className="absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-slate-500 px-1 text-[0.55rem] font-bold leading-none text-white ring-2 ring-surface">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/* Empty space the size of one IconAction — keeps the other icons in the same
   column on every row (e.g. rows that have no payment receipt). */
export function IconActionSpacer() {
  return <span className="inline-block h-7 w-7 shrink-0" aria-hidden="true" />;
}

export default IconAction;