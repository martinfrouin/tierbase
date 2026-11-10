import { genre, type Genre } from "@/lib/genre";

// AniList genres, as stored in titles.genres, most common first. "plural" reads before the kind: "Best romance manhwa".
export const READING_GENRES: Genre[] = [
  "Romance",
  "Drama",
  "Fantasy",
  "Action",
  "Comedy",
  "Adventure",
  "Slice of Life",
  "Supernatural",
  "Psychological",
  "Mystery",
  "Sci-Fi",
  "Horror",
  "Ecchi",
  "Thriller",
  "Sports",
  "Music",
  "Mecha",
  "Mahou Shoujo",
].map((name) => genre(name, name.toLowerCase()));
