import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import FavoritesPicker from "@/components/FavoritesPicker";
import RateButtons from "@/components/RateButtons";
import TierListNudge from "@/components/TierListNudge";
import { getLibrary, getRanking, personalRecommendations, type LibraryEntry } from "@/lib/data";
import { currentUserId } from "@/lib/user";

const DASHBOARD_MIN_RANKED = 3;

function Onboarding({ suggestions }: { suggestions: Awaited<ReturnType<typeof getRanking>> }) {
  return (
    <>
      <section className="hero">
        <h1>Find your next read</h1>
        <p className="muted">
          Pick a few manga, manhwa or manhua you loved. We&apos;ll recommend what readers with the same taste loved too,
          based on thousands of Reddit recommendations and everyone&apos;s tier lists.
        </p>
        <ol className="steps">
          <li>
            <strong>Pick a few favorites</strong>
            <span className="muted">Instant recommendations from readers who loved them too</span>
          </li>
          <li>
            <strong>Rank what you&apos;ve read</strong>
            <span className="muted">Your tier list tells us what you love and what to stop suggesting</span>
          </li>
          <li>
            <strong>Get sharper picks</strong>
            <span className="muted">The more you rank, the better your recommendations</span>
          </li>
        </ol>
      </section>
      <FavoritesPicker suggestions={suggestions} />
    </>
  );
}

async function Dashboard({ userId, library }: { userId: string; library: LibraryEntry[] }) {
  const inLibrary = new Set(library.map((e) => e.title.id));
  const [recs, ranking] = await Promise.all([personalRecommendations(userId, 6), getRanking()]);
  const unranked = ranking.filter((t) => !inLibrary.has(t.id)).slice(0, 8);

  return (
    <>
      <section className="hero">
        <h1>Your next reads</h1>
      </section>
      <TierListNudge ranked={library.filter((e) => e.tier).length} />

      {recs.length > 0 && (
        <>
          <h2>
            Recommended for you{" "}
            <Link href="/for-you" className="see-all">
              See all →
            </Link>
          </h2>
          <div className="cover-grid">
            {recs.map((r) => (
              <Link key={r.title.id} href={`/title/${r.title.slug}`} className="cover-tile">
                <Cover src={r.title.cover} size="medium" />
                <span>{r.title.name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {unranked.length > 0 && (
        <>
          <h2>Have you read these?</h2>
          <p className="muted">Popular titles not in your tier list yet. One tap adds them.</p>
          <ol className="rec-list">
            {unranked.map((t) => (
              <li key={t.id} className="rec">
                <Link href={`/title/${t.slug}`}>
                  <Cover src={t.cover} size="medium" />
                </Link>
                <div>
                  <Link href={`/title/${t.slug}`} className="rec-name">
                    {t.name}
                  </Link>
                  <RateButtons titleId={t.id} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

async function HomeContent() {
  const userId = await currentUserId();
  const library = userId ? await getLibrary(userId) : [];
  if (userId && library.filter((e) => e.tier).length >= DASHBOARD_MIN_RANKED) {
    return <Dashboard userId={userId} library={library} />;
  }
  const inLibrary = new Set(library.map((e) => e.title.id));
  const suggestions = (await getRanking()).filter((t) => !inLibrary.has(t.id)).slice(0, 36);
  return <Onboarding suggestions={suggestions} />;
}

export default function Home() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <HomeContent />
    </Suspense>
  );
}
