import Link from "next/link";
import type { Genre } from "@/lib/genre";
import { KINDS, type Kind } from "@/lib/kinds";
import { filtersLabel } from "@/lib/list-filters";
import type { TitleFilters } from "@/lib/title-filters";

// One "Filter" button opening the kinds (Reading) and genres; it names the active filter and clears it in one tap.
// Options are links, or buttons when onSelect is given (the editable tier list filters without navigating).
export default function FilterMenu({
  kinds,
  genres,
  active,
  href,
  onSelect,
}: {
  kinds: Kind[];
  genres: Genre[];
  active: TitleFilters;
  href?: (filters: TitleFilters) => string;
  onSelect?: (filters: TitleFilters) => void;
}) {
  if (kinds.length + genres.length === 0) return null;
  const label = filtersLabel(active);

  const option = (key: string, selected: boolean, next: TitleFilters, text: string, className = "chip") => {
    const classes = selected ? `${className} active` : className;
    if (onSelect) {
      return (
        <button key={key} type="button" className={classes} aria-pressed={selected} onClick={() => onSelect(next)}>
          {text}
        </button>
      );
    }
    return (
      <Link key={key} className={classes} href={href!(next)} aria-current={selected ? "true" : undefined}>
        {text}
      </Link>
    );
  };
  const kindLabel = (kind: Kind) => KINDS.find((k) => k.value === kind)?.label ?? kind;

  return (
    <div className="filter-menu">
      {/* Keyed on the filter so it closes once one is picked */}
      <details key={label ?? "all"}>
        <summary className={label ? "filter-button active" : "filter-button"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z" strokeLinejoin="round" />
          </svg>
          {label ? `Filter: ${label}` : "Filter"}
        </summary>
        <div className="filter-panel">
          {kinds.length > 0 && (
            <>
              <p className="filter-heading">Type</p>
              <div className="chips">
                {option("all", !active.kind, { ...active, kind: undefined }, "All")}
                {kinds.map((k) => option(k, active.kind === k, { ...active, kind: k }, kindLabel(k)))}
              </div>
            </>
          )}
          {genres.length > 0 && (
            <>
              <p className="filter-heading">Genre</p>
              <div className="chips">
                {option("all", !active.genre, { ...active, genre: undefined }, "All")}
                {genres.map((g) => option(g.slug, active.genre === g, { ...active, genre: g }, g.name))}
              </div>
            </>
          )}
        </div>
      </details>
      {label && option("clear", false, {}, "✕", "filter-button filter-clear")}
    </div>
  );
}
