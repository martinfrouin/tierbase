import { GAME_GENRES } from "@/lib/game-genres";
import type { Genre } from "@/lib/genre";
import { parseKind, type Kind } from "@/lib/kinds";
import { READING_GENRES } from "@/lib/reading-genres";
import type { Universe } from "@/lib/universes";

// What the ranking and For you lists can be narrowed to: a kind (Reading only) and a genre, combined
export interface TitleFilters {
  kind?: Kind;
  genre?: Genre;
}

export type FilterParams = { kind?: string; genre?: string };

export function genresOf(universe: Universe): Genre[] {
  return universe === "games" ? GAME_GENRES : READING_GENRES;
}

export function parseFilters(universe: Universe, params: FilterParams): TitleFilters {
  return {
    kind: universe === "reading" ? (parseKind(params.kind) ?? undefined) : undefined,
    genre: genresOf(universe).find((g) => g.slug === params.genre),
  };
}

export function filterParams({ kind, genre }: TitleFilters): FilterParams {
  return { ...(kind && { kind }), ...(genre && { genre: genre.slug }) };
}

// "romance manhwa", "roguelites", or with a genre alone "seinen " + anyKind; null without a filter
export function describeFilters(universe: Universe, { kind, genre }: TitleFilters, anyKind: string): string | null {
  if (universe === "games") return genre?.plural ?? null;
  if (!kind && !genre) return null;
  return [genre?.plural, kind ?? anyKind].filter(Boolean).join(" ");
}
