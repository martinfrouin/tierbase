import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import RateButtons from "@/components/RateButtons";
import { getLibrary, personalRecommendations } from "@/lib/data";
import { currentUserId } from "@/lib/user";

export const metadata: Metadata = { title: "For you" };

async function Recommendations() {
  const userId = await currentUserId();
  const library = userId ? await getLibrary(userId) : [];
  const liked = library.filter((e) => e.tier === "S" || e.tier === "A");

  if (liked.length === 0) {
    return (
      <p className="empty">
        Tell us what you loved first. <Link href="/">Pick a few favorites →</Link>
      </p>
    );
  }

  const recs = await personalRecommendations(userId!);
  return (
    <>
      <p className="muted">
        Based on {liked.length} title{liked.length > 1 ? "s" : ""} you loved. Rate what you&apos;ve read to sharpen
        these. <Link href="/">Add favorites</Link> · <Link href="/tierlist">Your tier list</Link>
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
                <p className="muted">Because you liked {r.because.map((b) => b.name).join(" and ")}</p>
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
