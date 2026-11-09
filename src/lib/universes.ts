export type Universe = "reading" | "games";

export const UNIVERSES: Universe[] = ["reading", "games"];

export function parseUniverse(value: string | null | undefined): Universe | null {
  return UNIVERSES.includes(value as Universe) ? (value as Universe) : null;
}

export interface UniverseConfig {
  id: Universe;
  label: string;
  emoji: string;
  basePath: string;
  titlePath: string;
  // For sentences: "Have you read it?" / "Have you played it?"
  verb: string;
  past: string;
  people: string;
  person: string;
  // "Find your next read" / "Your next reads"
  next: string;
  nextPlural: string;
  want: string;
  // "Pick a few manga, manhwa or manhua you loved"
  catalog: string;
  searchPlaceholder: string;
  source: { name: string; url: string };
}

export const UNIVERSE_CONFIG: Record<Universe, UniverseConfig> = {
  reading: {
    id: "reading",
    label: "Reading",
    emoji: "📖",
    basePath: "/reading",
    titlePath: "/reading/title",
    verb: "read",
    past: "read",
    people: "readers",
    person: "reader",
    next: "read",
    nextPlural: "reads",
    want: "Want to read",
    catalog: "manga, manhwa or manhua",
    searchPlaceholder: "Search any manga, manhwa or manhua…",
    source: { name: "AniList", url: "https://anilist.co" },
  },
  games: {
    id: "games",
    label: "Games",
    emoji: "🎮",
    basePath: "/games",
    titlePath: "/games/title",
    verb: "play",
    past: "played",
    people: "players",
    person: "player",
    next: "game",
    nextPlural: "games",
    want: "Want to play",
    catalog: "games",
    searchPlaceholder: "Search any game…",
    source: { name: "IGDB", url: "https://www.igdb.com" },
  },
};

// Every page of a universe lives under its base path. The landing page, contact and legal pages belong to none.
export function universeOfPath(pathname: string): Universe | null {
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  return UNIVERSES.find((u) => under(UNIVERSE_CONFIG[u].basePath)) ?? null;
}

export function titleHref(title: { slug: string; universe: Universe }): string {
  return `${UNIVERSE_CONFIG[title.universe].titlePath}/${title.slug}`;
}

export function universePath(universe: Universe, path: "" | "/ranking" | "/tierlist" = ""): string {
  return UNIVERSE_CONFIG[universe].basePath + path;
}
