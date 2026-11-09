import { GAME_GENRES } from "@/lib/game-genres";
import { KINDS, type Kind } from "@/lib/kinds";
import type { Universe } from "@/lib/universes";

// Narrows a tier list to one part of a universe: a kind for Reading (manhwa…), a genre for Games (roguelites…)
export interface ListFilter {
  // Query parameter on share links and image downloads
  param: "kind" | "genre";
  value: string;
  label: string;
  // What the filter is called in "Clear … tiers" and file names
  name: string;
  kind?: Kind;
  genre?: string;
}

export interface FilterableTitle {
  kind: Kind;
  genres: string[];
}

export function listFilters(universe: Universe): ListFilter[] {
  if (universe === "reading") {
    return KINDS.map((k) => ({ param: "kind", value: k.value, label: k.label, name: k.value, kind: k.value }));
  }
  return GAME_GENRES.map((g) => ({ param: "genre", value: g.slug, label: g.name, name: g.slug, genre: g.name }));
}

export function matchesFilter(filter: ListFilter | null, title: FilterableTitle): boolean {
  if (!filter) return true;
  return filter.kind ? title.kind === filter.kind : title.genres.includes(filter.genre!);
}

export function parseListFilter(universe: Universe, params: { kind?: string | null; genre?: string | null }): ListFilter | null {
  return listFilters(universe).find((f) => f.value === params[f.param]) ?? null;
}

// Filters worth offering for a list: the ones that match at least one of its titles, most used first for genres
export function filtersInUse(universe: Universe, titles: FilterableTitle[]): ListFilter[] {
  const used = listFilters(universe)
    .map((f) => ({ f, n: titles.filter((t) => matchesFilter(f, t)).length }))
    .filter(({ n }) => n > 0);
  if (universe === "games") used.sort((a, b) => b.n - a.n);
  return used.map(({ f }) => f);
}
