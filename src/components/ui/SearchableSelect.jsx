import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

/*
 * SearchableSelect
 *
 * Drop-in replacement for <Select> when the list should be searchable.
 *
 *   <SearchableSelect
 *     value={partyId}
 *     onChange={(value) => setPartyId(value)}   // receives the value, not an event
 *     options={[{ value: "1", label: "Ravi Timbers" }]}
 *     placeholder="Select customer…"
 *   />
 *
 * - Type to filter, ↑ / ↓ to move, Enter to choose, Esc to close.
 * - The menu is rendered in a portal, so it is never clipped by popups
 *   or scrolling containers.
 */

const MENU_MAX_HEIGHT = 260;

export function SearchableSelect({
  value = "",
  onChange,
  options = [],
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found",
  disabled = false,
  className = "",
  buttonRef = null,
  footerAction = null, // { label, onClick } — e.g. "+ Add New Customer"
  clearable = false, // shows an × to unselect, and clicking the chosen row unselects it
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const selected =
    options.find((option) => String(option.value) === String(value)) || null;

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return options;

    return options.filter((option) =>
      String(option.label ?? "")
        .toLowerCase()
        .includes(search),
    );
  }, [options, query]);

  /* ---------------------------------------------------------------- open */

  const openMenu = () => {
    if (disabled) return;

    const selectedIndex = options.findIndex(
      (option) => String(option.value) === String(value),
    );

    setQuery("");
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setRect(triggerRef.current?.getBoundingClientRect() || null);
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange?.("");
    closeMenu();
  };

  const choose = (option) => {
    if (!option) return;

    /* clicking the already-selected row unselects it (clearable lists only) */
    if (clearable && String(option.value) === String(value)) {
      clear();
      triggerRef.current?.focus();
      return;
    }

    onChange?.(String(option.value));
    closeMenu();
    triggerRef.current?.focus();
  };

  /* Focus the search box when the menu opens */
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  /* Keep the menu attached to the trigger */
  useEffect(() => {
    if (!open) return undefined;

    const update = () => {
      if (triggerRef.current) {
        setRect(triggerRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  /* Close when clicking outside */
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  /* Scroll the highlighted option into view */
  useEffect(() => {
    if (!open) return;

    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, filtered.length]);

  /* ------------------------------------------------------------ keyboard */

  const onSearchKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(filtered.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      choose(filtered[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      /* Close only this menu, not the popup that contains it */
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "Tab") {
      closeMenu();
    }
  };

  const onTriggerKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  };

  /* ------------------------------------------------------------ position */

  let menuStyle = null;

  if (open && rect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < MENU_MAX_HEIGHT && rect.top > spaceBelow;

    menuStyle = {
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 100,
      ...(openUpwards
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    };
  }

  /* ------------------------------------------------------------------ UI */

  const showClear = clearable && Boolean(selected) && !disabled;

  return (
    <>
      <div className="relative w-full">
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (buttonRef) buttonRef.current = node;
        }}
        type="button"
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left text-sm outline-none transition",
          open ? "border-primary-500" : "border-line focus:border-primary-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ].join(" ")}
      >
        <span
          className={[
            "min-w-0 flex-1 truncate",
            selected ? "font-semibold text-ink" : "text-muted",
          ].join(" ")}
        >
          {selected ? selected.label : placeholder}
        </span>

        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-muted transition",
            open ? "rotate-180" : "",
            showClear ? "mr-5" : "",
          ].join(" ")}
        />
      </button>

      {showClear && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear selection"
          title="Clear selection"
          className="absolute right-8 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-red-500/10 hover:text-red-500"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      </div>

      {menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="h-4 w-4 shrink-0 text-muted" />

              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>

            <div
              ref={listRef}
              role="listbox"
              className="overflow-y-auto py-1"
              style={{ maxHeight: MENU_MAX_HEIGHT }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-muted">
                  {emptyText}
                </div>
              ) : (
                filtered.map((option, index) => {
                  const isSelected =
                    String(option.value) === String(value);
                  const isActive = index === activeIndex;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-active={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(option)}
                      className={[
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition",
                        isActive ? "bg-primary-500/10" : "",
                        isSelected
                          ? "font-bold text-primary-600"
                          : "font-medium text-ink",
                      ].join(" ")}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>

                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-primary-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {footerAction && (
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  footerAction.onClick?.(query.trim());
                }}
                className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm font-bold text-primary-600 transition hover:bg-primary-500/10"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{footerAction.label}</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

export default SearchableSelect;