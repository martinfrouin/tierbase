export interface GameGenre {
  name: string;
  slug: string;
  // "Best roguelites"
  plural: string;
}

const genre = (name: string, plural: string): GameGenre => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  plural,
});

// Same names and order as GAME_GENRE_RULES in scripts/lib/game-genres.ts (the worker image can't import src/)
export const GAME_GENRES: GameGenre[] = [
  genre("Roguelite", "roguelites"),
  genre("Deckbuilder", "deckbuilders"),
  genre("Metroidvania", "metroidvanias"),
  genre("Soulslike", "soulslikes"),
  genre("RPG", "RPGs"),
  genre("JRPG", "JRPGs"),
  genre("Strategy", "strategy games"),
  genre("Shooter", "shooters"),
  genre("Platformer", "platformers"),
  genre("Puzzle", "puzzle games"),
  genre("Adventure", "adventure games"),
  genre("Fighting", "fighting games"),
  genre("Racing", "racing games"),
  genre("Sports", "sports games"),
  genre("Simulation", "simulation games"),
  genre("Visual novel", "visual novels"),
  genre("Survival", "survival games"),
  genre("Horror", "horror games"),
  genre("Open world", "open world games"),
  genre("Cozy", "cozy games"),
  genre("Indie", "indie games"),
];

export function parseGenre(slug: string | null | undefined): GameGenre | null {
  return GAME_GENRES.find((g) => g.slug === slug) ?? null;
}
