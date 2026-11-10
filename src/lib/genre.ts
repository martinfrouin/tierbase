export interface Genre {
  // As stored in titles.genres
  name: string;
  slug: string;
  // What a list of them is called: "Best roguelites", "Best romance manhwa"
  plural: string;
}

export const genre = (name: string, plural: string): Genre => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  plural,
});
