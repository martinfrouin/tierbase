import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import FavoritesPicker from "@/components/FavoritesPicker";
import RateButtons from "@/components/RateButtons";
import TierListNudge from "@/components/TierListNudge";
import {
  getGenres,
  getLibrary,
  getRanking,
  KINDS,
  personalRecommendations,
  scoreOutOf100,
  type LibraryEntry,
  type TitleCard,
} from "@/lib/data";
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

const SHOWN_SOURCES = 3;
const RECOMMENDATIONS = 20;
const UNRANKED = 8;

function Because({ titles }: { titles: TitleCard[] }) {
  const names = titles.map((t) => t.name);
  if (names.length <= SHOWN_SOURCES) {
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    return <p className="muted">Because you liked {list}</p>;
  }
  return (
    <details className="because muted">
      <summary>
        Because you liked {names.slice(0, SHOWN_SOURCES).join(", ")} + {names.length - SHOWN_SOURCES} more
      </summary>
      {names.slice(SHOWN_SOURCES).join(", ")}
    </details>
  );
}

async function Dashboard({ userId, library }: { userId: string; library: LibraryEntry[] }) {
  const inLibrary = new Set(library.map((e) => e.title.id));
  const liked = library.filter((e) => e.tier === "S" || e.tier === "A");
  const [recs, ranking] = await Promise.all([personalRecommendations(userId, RECOMMENDATIONS), getRanking()]);
  const unranked = ranking.filter((t) => !inLibrary.has(t.id)).slice(0, UNRANKED);
  const genres = await getGenres(unranked.map((t) => t.id));

  return (
    <>
      <section className="hero">
        <h1>Your next reads</h1>
      </section>
      <TierListNudge ranked={library.filter((e) => e.tier).length} />

      <h2>Recommended for you</h2>
      {liked.length === 0 ? (
        <p className="empty">
          Mark a few titles as Loved or Liked below, or in <Link href="/tierlist">your tier list</Link>, to get
          recommendations.
        </p>
      ) : recs.length === 0 ? (
        <p className="empty">Not enough readers share your picks yet. Try adding a few more popular favorites.</p>
      ) : (
        <>
          <p className="muted">
            Based on {liked.length} title{liked.length > 1 ? "s" : ""} you loved.
          </p>
          <ol className="rec-list">
            {recs.map((r) => (
              <li key={r.title.id} className="rec">
                <Link href={`/title/${r.title.slug}`}>
                  <Cover src={r.title.cover} size="medium" />
                </Link>
                <div>
                  <Link href={`/title/${r.title.slug}`} className="rec-name">
                    {r.title.name}
                  </Link>
                  <p className="rec-match">
                    <strong>{r.match}% match</strong> · liked by {r.readers} reader{r.readers > 1 ? "s" : ""} who
                    share your taste
                  </p>
                  <Because titles={r.because} />
                  <RateButtons titleId={r.title.id} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {unranked.length > 0 && (
        <>
          <h2>Have you read these?</h2>
          <p className="muted">Popular titles not in your tier list yet. One tap adds them.</p>
          <ol className="rec-list">
            {unranked.map((t) => (
              <li key={t.id} className="rec compact">
                <Link href={`/title/${t.slug}`}>
                  <Cover src={t.cover} size="medium" />
                </Link>
                <div>
                  <Link href={`/title/${t.slug}`} className="rec-name">
                    {t.name}
                  </Link>
                  <p className="muted rec-meta">
                    {[
                      KINDS.find((k) => k.value === t.kind)?.label,
                      genres.get(t.id)?.slice(0, 3).join(", "),
                      `${scoreOutOf100(t.score)}/100`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
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
