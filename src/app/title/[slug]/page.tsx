import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import RateButtons from "@/components/RateButtons";
import { getEntry, getQuotes, getTitle, KINDS, similarTitles } from "@/lib/data";
import { currentUserId } from "@/lib/user";

export async function generateMetadata({ params }: PageProps<"/title/[slug]">): Promise<Metadata> {
  const title = await getTitle((await params).slug);
  return { title: title?.name };
}

async function MyRating({ titleId }: { titleId: number }) {
  const userId = await currentUserId();
  const current = userId ? await getEntry(userId, titleId) : null;
  return <RateButtons titleId={titleId} current={current} />;
}

async function TitleContent({ params }: { params: Promise<{ slug: string }> }) {
  const title = await getTitle((await params).slug);
  if (!title) notFound();
  const [similar, quotes] = await Promise.all([similarTitles(title.id), getQuotes(title.id)]);

  return (
    <article className="title-page">
      <div className="title-header">
        <Cover src={title.cover} size="large" />
        <div>
          <h1>{title.name}</h1>
          {title.romaji && title.romaji !== title.name && <p className="muted">{title.romaji}</p>}
          <p className="muted">
            <span className="tag">{KINDS.find((k) => k.value === title.kind)?.label}</span>{" "}
            {title.rank > 0 && (
              <>
                #{title.rank} · {title.score.toFixed(1)}/5 ·{" "}
              </>
            )}
            {title.mentions} Reddit mention{title.mentions === 1 ? "" : "s"} · {title.votes} vote{title.votes === 1 ? "" : "s"}
          </p>
          {title.genres.length > 0 && <p className="muted">{title.genres.join(" · ")}</p>}
          {title.url && (
            <a href={title.url} target="_blank" rel="noreferrer" className="muted">
              More info ↗
            </a>
          )}
          <h2>Have you read it?</h2>
          <Suspense fallback={<div className="rate-buttons" />}>
            <MyRating titleId={title.id} />
          </Suspense>
        </div>
      </div>

      <h2>Readers who loved it also loved</h2>
      {similar.length === 0 ? (
        <p className="muted">Not enough readers yet to tell.</p>
      ) : (
        <div className="cover-grid">
          {similar.map((r) => (
            <Link key={r.title.id} href={`/title/${r.title.slug}`} className="cover-tile">
              <Cover src={r.title.cover} size="medium" />
              <span>{r.title.name}</span>
            </Link>
          ))}
        </div>
      )}

      {quotes.length > 0 && (
        <>
          <h2>What Reddit says</h2>
          <div className="quotes">
            {quotes.map((q) => (
              <blockquote key={q.url}>
                <a href={q.thread.url} target="_blank" rel="noreferrer" className="quote-thread">
                  r/{q.thread.subreddit} · {q.thread.title}
                </a>
                <p>{q.body}</p>
                <footer>
                  <a href={q.url} target="_blank" rel="noreferrer">
                    u/{q.author} · {q.score} pts
                  </a>
                </footer>
              </blockquote>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

export default function TitlePage({ params }: PageProps<"/title/[slug]">) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <TitleContent params={params} />
    </Suspense>
  );
}
