export interface IgdbTags {
  genres: string[];
  themes: string[];
  keywords: string[];
}

interface Rule {
  genre: string;
  genres?: string[];
  themes?: string[];
  keywords?: string[];
}

// Site genres, in display order (src/lib/game-genres.ts repeats the names for the UI: keep both in sync).
// Players don't separate roguelikes from roguelites in tier lists, so one genre covers both.
export const GAME_GENRE_RULES: Rule[] = [
  {
    genre: "Roguelite",
    keywords: [
      "roguelite",
      "roguelike",
      "rogue-lite",
      "rogue-like",
      "action roguelike",
      "action roguelite",
      "traditional roguelike",
      "roguelike deckbuilder",
      "roguelike horror",
      "roguelike platform",
    ],
  },
  { genre: "Deckbuilder", keywords: ["deckbuilding", "deck building", "deck-building", "deckbuilder", "roguelike deckbuilder"] },
  { genre: "Metroidvania", keywords: ["metroidvania"] },
  { genre: "Soulslike", keywords: ["soulslike", "souls-like"] },
  { genre: "RPG", genres: ["Role-playing (RPG)"] },
  { genre: "JRPG", keywords: ["jrpg"] },
  { genre: "Strategy", genres: ["Strategy", "Real Time Strategy (RTS)", "Turn-based strategy (TBS)", "Tactical"] },
  { genre: "Shooter", genres: ["Shooter"] },
  { genre: "Platformer", genres: ["Platform"] },
  { genre: "Puzzle", genres: ["Puzzle"] },
  { genre: "Adventure", genres: ["Adventure", "Point-and-click"] },
  { genre: "Fighting", genres: ["Fighting"] },
  { genre: "Racing", genres: ["Racing"] },
  { genre: "Sports", genres: ["Sport"] },
  { genre: "Simulation", genres: ["Simulator"] },
  { genre: "Visual novel", genres: ["Visual Novel"] },
  { genre: "Survival", themes: ["Survival"] },
  { genre: "Horror", themes: ["Horror"] },
  { genre: "Open world", themes: ["Open world"] },
  { genre: "Cozy", keywords: ["cozy", "wholesome"] },
  { genre: "Indie", genres: ["Indie"] },
];

const lower = (list: string[]) => new Set(list.map((s) => s.toLowerCase()));

export function deriveGenres(tags: IgdbTags, corrections?: { add?: string[]; remove?: string[] }): string[] {
  const genres = lower(tags.genres);
  const themes = lower(tags.themes);
  const keywords = lower(tags.keywords);
  const found = GAME_GENRE_RULES.filter(
    (r) =>
      r.genres?.some((g) => genres.has(g.toLowerCase())) ||
      r.themes?.some((t) => themes.has(t.toLowerCase())) ||
      r.keywords?.some((k) => keywords.has(k)),
  ).map((r) => r.genre);
  const removed = new Set(corrections?.remove ?? []);
  return [...new Set([...found, ...(corrections?.add ?? [])])].filter((g) => !removed.has(g));
}
