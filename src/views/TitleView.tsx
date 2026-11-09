import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Cover from "@/components/Cover";
import Synopsis from "@/components/Synopsis";
import RateButtons from "@/components/RateButtons";
import { getEntry, getQuotes, getTitle, scoreOutOf100, similarTitles, TIERS, type TitleDetail } from "@/lib/data";
import { kindLabel } from "@/lib/kinds";
import { SITE_URL } from "@/lib/site";
import { titleHref, UNIVERSE_CONFIG, type Universe } from "@/lib/universes";
import { currentUserId } from "@/lib/user";

// "Manhwa like Solo Leveling" and "Games like Hades" are what people search for, so they lead the page title
function likeHeading(title: TitleDetail) {
  const kind = title.universe === "games" ? "Games" : title.kind[0].toUpperCase() + title.kind.slice(1);
  return `${kind} like ${title.name}`;
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, text.lastIndexOf(" ", max))}…`;
}

export async function titleMetadata(universe: Universe, params: Promise<{ slug: string }>): Promise<Metadata> {
  const title = await getTitle((await params).slug, universe);
  if (!title) return {};
  const config = UNIVERSE_CONFIG[universe];
  const similar = await similarTitles(title.id);
  const pageTitle = similar.length > 0 ? likeHeading(title) : title.name;
  const names = similar.slice(0, 3).map((r) => r.title.name).join(", ");
  const more = similar.length > 3 ? ` and ${similar.length - 3} more` : "";
  const sources = `${title.mentions} Reddit recommendation${title.mentions === 1 ? "" : "s"} and TierBase tier lists`;
  const people = config.people[0].toUpperCase() + config.people.slice(1);
  const description =
    similar.length > 0
      ? `${people} who loved ${title.name} also loved ${names}${more}. Built from ${sources}.`
      : truncate(title.description ?? `${title.name} on TierBase: Reddit recommendations and ${config.person} tier lists.`, 160);
  return {
    title: pageTitle,
    description,
    alternates: { canonical: titleHref(title) },
    openGraph: { title: pageTitle, description, type: "website" },
  };
}

async function MyRating({ titleId, universe }: { titleId: number; universe: Universe }) {
  const userId = await currentUserId();
  const current = userId ? await getEntry(userId, titleId) : null;
  return <RateButtons titleId={titleId} current={current} universe={universe} />;
}

async function TitleContent({ universe, params }: { universe: Universe; params: Promise<{ slug: string }> }) {
  const title = await getTitle((await params).slug, universe);
  if (!title) notFound();
  const config = UNIVERSE_CONFIG[universe];
  const [similar, quotes] = await Promise.all([similarTitles(title.id), getQuotes(title.id)]);
  const originalTitles = [title.romaji, title.native].filter((n): n is string => !!n && n !== title.name);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": universe === "games" ? "VideoGame" : "Book",
    name: title.name,
    alternateName: originalTitles.length > 0 ? originalTitles : undefined,
    url: `${SITE_URL}${titleHref(title)}`,
    image: title.cover.startsWith("http") ? title.cover : `${SITE_URL}${title.cover}`,
    description: title.description ?? undefined,
    genre: title.genres.length > 0 ? title.genres : undefined,
    datePublished: title.year ? String(title.year) : undefined,
    sameAs: title.url || undefined,
  };

  return (
    <article className="title-page">
      <script
        type="application/ld+json"
        // Escaped so a "</script>" inside a synopsis can't close the tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="title-header">
        <Cover src={title.cover} size="large" />
        <div>
          <h1>{title.name}</h1>
          {originalTitles.length > 0 && <p className="muted">Original title: {originalTitles.join(" · ")}</p>}
          <p className="muted">
            <span className="tag">{kindLabel(title.kind)}</span> {title.year && <>{title.year} · </>}
            {title.rank > 0 && (
              <>
                #{title.rank} · {scoreOutOf100(title.score)}/100 ·{" "}
              </>
            )}
            {title.mentions} Reddit mention{title.mentions === 1 ? "" : "s"}
          </p>
          {title.votes > 0 && (
            <p className="tier-votes muted">
              TierBase {config.people}:
              {TIERS.filter((t) => title.tierCounts[t] > 0).map((t) => (
                <span key={t} style={{ background: `var(--tier-${t.toLowerCase()})` }}>
                  {t} × {title.tierCounts[t]}
                </span>
              ))}
            </p>
          )}
          {title.genres.length > 0 && <p className="muted">{title.genres.join(" · ")}</p>}
          {title.description && <Synopsis text={title.description} />}
          {title.url && (
            <a href={title.url} target="_blank" rel="noreferrer" className="muted">
              More info ↗
            </a>
          )}
          <h2>Have you {config.past} it?</h2>
          <Suspense fallback={<div className="rate-buttons" />}>
            <MyRating titleId={title.id} universe={universe} />
          </Suspense>
        </div>
      </div>

      <h2>{likeHeading(title)}</h2>
      <p className="muted">What {config.people} who loved it also loved.</p>
      {similar.length === 0 ? (
        <p className="muted">Not enough {config.people} yet to tell.</p>
      ) : (
        <div className="cover-grid">
          {similar.map((r) => (
            <Link key={r.title.id} href={titleHref(r.title)} className="cover-tile">
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

export default function TitleView({ universe, params }: { universe: Universe; params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <TitleContent universe={universe} params={params} />
    </Suspense>
  );
}
