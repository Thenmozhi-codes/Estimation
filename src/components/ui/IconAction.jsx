import { cn } from "@/lib/utils/cn";

const TONES = {
  slate: "text-slate-500 hover:bg-slate-500/10 hover:text-ink",
  primary: "text-primary-600 hover:bg-primary-500/10",
  sky: "text-sky-600 hover:bg-sky-500/10",
  emerald: "text-emerald-600 hover:bg-emerald-500/10",
  red: "text-red-500 hover:bg-red-500/10",
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
        "relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        TONES[tone],
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />

      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[0.6rem] font-bold leading-none text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default IconAction;
