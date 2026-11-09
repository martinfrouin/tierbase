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
  personalRecommendations,
  scoreOutOf100,
  type LibraryEntry,
  type RankedTitle,
  type TitleCard,
} from "@/lib/data";
import { kindLabel } from "@/lib/kinds";
import { titleHref, UNIVERSE_CONFIG, universePath, type Universe } from "@/lib/universes";
import { currentUserId } from "@/lib/user";

const DASHBOARD_MIN_RANKED = 3;
const SHOWN_SOURCES = 3;
const RECOMMENDATIONS = 20;
const UNRANKED = 8;
const SUGGESTIONS = 36;

function Onboarding({ universe, suggestions }: { universe: Universe; suggestions: RankedTitle[] }) {
  const config = UNIVERSE_CONFIG[universe];
  return (
    <>
      <section className="hero">
        <h1>Find your next {config.next}</h1>
        <p className="muted">
          Pick a few {config.catalog} you loved. We&apos;ll recommend what {config.people} with the same taste loved
          too, based on thousands of Reddit recommendations and everyone&apos;s tier lists.
        </p>
        <ol className="steps">
          <li>
            <strong>Pick a few favorites</strong>
            <span className="muted">Instant recommendations from {config.people} who loved them too</span>
          </li>
          <li>
            <strong>Rank what you&apos;ve {config.past}</strong>
            <span className="muted">Your tier list tells us what you love and what to stop suggesting</span>
          </li>
          <li>
            <strong>Get sharper picks</strong>
            <span className="muted">The more you rank, the better your recommendations</span>
          </li>
        </ol>
      </section>
      <FavoritesPicker suggestions={suggestions} universe={universe} />
    </>
  );
}

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

async function Dashboard({ universe, userId, library }: { universe: Universe; userId: string; library: LibraryEntry[] }) {
  const config = UNIVERSE_CONFIG[universe];
  const inLibrary = new Set(library.map((e) => e.title.id));
  const liked = library.filter((e) => e.tier === "S" || e.tier === "A");
  const [recs, ranking] = await Promise.all([
    personalRecommendations(userId, RECOMMENDATIONS, universe),
    getRanking({ universe }),
  ]);
  const unranked = ranking.filter((t) => !inLibrary.has(t.id)).slice(0, UNRANKED);
  const genres = await getGenres(unranked.map((t) => t.id));
  const noun = universe === "games" ? "games" : "titles";

  return (
    <>
      <section className="hero">
        <h1>Your next {config.nextPlural}</h1>
      </section>
      <TierListNudge ranked={library.filter((e) => e.tier).length} universe={universe} />

      <h2>Recommended for you</h2>
      {liked.length === 0 ? (
        <p className="empty">
          Mark a few {noun} as Loved or Liked below, or in{" "}
          <Link href={universePath(universe, "/tierlist")}>your tier list</Link>, to get recommendations.
        </p>
      ) : recs.length === 0 ? (
        <p className="empty">Not enough {config.people} share your picks yet. Try adding a few more popular favorites.</p>
      ) : (
        <>
          <p className="muted">
            Based on {liked.length} {liked.length > 1 ? noun : noun.slice(0, -1)} you loved.
          </p>
          <ol className="rec-list">
            {recs.map((r) => (
              <li key={r.title.id} className="rec">
                <Link href={titleHref(r.title)}>
                  <Cover src={r.title.cover} size="medium" />
                </Link>
                <div>
                  <Link href={titleHref(r.title)} className="rec-name">
                    {r.title.name}
                  </Link>
                  <p className="rec-match">
                    <strong>{r.match}% match</strong> · liked by {r.readers}{" "}
                    {r.readers > 1 ? config.people : config.person} who share your taste
                  </p>
                  <Because titles={r.because} />
                  <RateButtons titleId={r.title.id} universe={universe} wantFirst />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {unranked.length > 0 && (
        <>
          <h2>Already {config.past} these?</h2>
          <p className="muted">Popular {noun} not in your tier list yet. Rate them to sharpen your recommendations.</p>
          <ol className="rec-list">
            {unranked.map((t) => (
              <li key={t.id} className="rec compact">
                <Link href={titleHref(t)}>
                  <Cover src={t.cover} size="medium" />
                </Link>
                <div>
                  <Link href={titleHref(t)} className="rec-name">
                    {t.name}
                  </Link>
                  <p className="muted rec-meta">
                    {[
                      universe === "reading" ? kindLabel(t.kind) : null,
                      genres.get(t.id)?.slice(0, 3).join(", "),
                      universe === "games" ? t.year : null,
                      `${scoreOutOf100(t.score)}/100`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <RateButtons titleId={t.id} universe={universe} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

async function HomeContent({ universe }: { universe: Universe }) {
  const userId = await currentUserId();
  const library = userId ? await getLibrary(userId, universe) : [];
  if (userId && library.filter((e) => e.tier).length >= DASHBOARD_MIN_RANKED) {
    return <Dashboard universe={universe} userId={userId} library={library} />;
  }
  const inLibrary = new Set(library.map((e) => e.title.id));
  const suggestions = (await getRanking({ universe })).filter((t) => !inLibrary.has(t.id)).slice(0, SUGGESTIONS);
  return <Onboarding universe={universe} suggestions={suggestions} />;
}

export default function HomeView({ universe }: { universe: Universe }) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <HomeContent universe={universe} />
    </Suspense>
  );
}
