import FilterMenu from "@/components/FilterMenu";
import { getRankedGenreCounts } from "@/lib/data";
import { KINDS } from "@/lib/kinds";
import { genresOf, type TitleFilters } from "@/lib/title-filters";
import type { Universe } from "@/lib/universes";

// A genre chip needs enough ranked titles to be worth opening
const MIN_GENRE_TITLES = 5;

// Ranking and For you filters: every kind (Reading), and the genres with enough ranked titles
export default async function FilterChips({
  universe,
  active,
  href,
}: {
  universe: Universe;
  active: TitleFilters;
  href: (filters: TitleFilters) => string;
}) {
  const counts = await getRankedGenreCounts(universe);
  const genres = genresOf(universe).filter(
    (g) => (counts.get(g.name) ?? 0) >= MIN_GENRE_TITLES || g === active.genre,
  );
  const kinds = universe === "reading" ? KINDS.map((k) => k.value) : [];
  return <FilterMenu kinds={kinds} genres={genres} active={active} href={href} />;
}
