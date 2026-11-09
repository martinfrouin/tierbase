export type Universe = "reading" | "games";

// Sources per kind, so manga, manhwa and manhua each get comparable coverage.
// Manhwa subreddits are far busier: the manga side gets the smaller demographic communities too.
export const SUBREDDITS: { name: string; universe: Universe }[] = [
  { name: "manhwa", universe: "reading" },
  { name: "manhwarecommendations", universe: "reading" },
  { name: "webtoons", universe: "reading" },
  { name: "manga", universe: "reading" },
  { name: "MangaRecommendations", universe: "reading" },
  { name: "Seinen", universe: "reading" },
  { name: "shoujo", universe: "reading" },
  { name: "josei", universe: "reading" },
  { name: "manhua", universe: "reading" },
  { name: "roguelites", universe: "games" },
  { name: "roguelikes", universe: "games" },
  { name: "patientgamers", universe: "games" },
  { name: "gamingsuggestions", universe: "games" },
  { name: "ShouldIbuythisgame", universe: "games" },
  { name: "metroidvania", universe: "games" },
  { name: "JRPG", universe: "games" },
  { name: "CozyGamers", universe: "games" },
];

// Reddit returns the subreddit's own casing ("Manhua"), not the one used in the query
export function universeOf(subreddit: string): Universe {
  return SUBREDDITS.find((s) => s.name.toLowerCase() === subreddit.toLowerCase())?.universe ?? "reading";
}
