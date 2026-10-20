import FavoritesPicker from "@/components/FavoritesPicker";
import { getRanking } from "@/lib/data";

export default async function Home() {
  const suggestions = (await getRanking()).slice(0, 36);
  return (
    <>
      <section className="hero">
        <h1>Find your next read</h1>
        <p className="muted">
          Pick a few manga, manhwa or manhua you loved. We&apos;ll recommend what readers with the same taste loved too,
          based on thousands of Reddit recommendations and everyone&apos;s tier lists.
        </p>
      </section>
      <FavoritesPicker suggestions={suggestions} />
    </>
  );
}
