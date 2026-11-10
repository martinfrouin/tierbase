import type { Genre } from "@/lib/genre";
import { KINDS, type Kind } from "@/lib/kinds";
import { filterParams, genresOf, type TitleFilters } from "@/lib/title-filters";
import type { Universe } from "@/lib/universes";

// Narrowing a tier list (on the board, its share link and its image) with the same kind and genre filters as the rankings

export interface FilterableTitle {
  kind: Kind;
  genres: string[];
}

export function matchesFilters({ kind, genre }: TitleFilters, title: FilterableTitle): boolean {
  return (!kind || title.kind === kind) && (!genre || title.genres.includes(genre.name));
}

// Filters worth offering for a list: the kinds and genres of its titles, most used genres first
export function filtersInUse(universe: Universe, titles: FilterableTitle[]): { kinds: Kind[]; genres: Genre[] } {
  const kinds = universe === "reading" ? KINDS.map((k) => k.value).filter((k) => titles.some((t) => t.kind === k)) : [];
  const genres = genresOf(universe)
    .map((g) => ({ g, n: titles.filter((t) => t.genres.includes(g.name)).length }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ g }) => g);
  return { kinds, genres };
}

export function filtersQuery(filters: TitleFilters): string {
  const query = new URLSearchParams(filterParams(filters)).toString();
  return query ? `?${query}` : "";
}

// "Romance manhwa", "Manga", "Roguelite": what a narrowed list is called; null for the whole list
export function filtersLabel({ kind, genre }: TitleFilters): string | null {
  const label = [genre?.name, kind].filter(Boolean).join(" ");
  return label ? label[0].toUpperCase() + label.slice(1) : null;
}
