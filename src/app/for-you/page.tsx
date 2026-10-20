import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import RateButtons from "@/components/RateButtons";
import TierListNudge from "@/components/TierListNudge";
import { getLibrary, personalRecommendations, type TitleCard } from "@/lib/data";
import { currentUserId } from "@/lib/user";

export const metadata: Metadata = { title: "For you" };

const SHOWN_SOURCES = 3;

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

async function Recommendations() {
  const userId = await currentUserId();
  const library = userId ? await getLibrary(userId) : [];
  const liked = library.filter((e) => e.tier === "S" || e.tier === "A");

  if (liked.length === 0) {
    return (
      <p className="empty">
        Tell us what you loved first. <Link href="/">Pick a few favorites</Link> or{" "}
        <Link href="/tierlist">start your tier list →</Link>
      </p>
    );
  }

  const recs = await personalRecommendations(userId!);
  return (
    <>
      <TierListNudge ranked={library.filter((e) => e.tier).length} />
      <p className="muted">
        Based on {liked.length} title{liked.length > 1 ? "s" : ""} you loved.
      </p>
      {recs.length === 0 ? (
        <p className="empty">Not enough readers share your picks yet. Try adding a few more popular favorites.</p>
      ) : (
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
                  <strong>{r.match}% match</strong> · liked by {r.readers} reader{r.readers > 1 ? "s" : ""} who share
                  your taste
                </p>
                <Because titles={r.because} />
                <RateButtons titleId={r.title.id} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export default function ForYouPage() {
  return (
    <>
      <section className="hero">
        <h1>Recommended for you</h1>
      </section>
      <Suspense fallback={<p className="muted">Looking at what readers like you enjoyed…</p>}>
        <Recommendations />
      </Suspense>
    </>
  );
}
