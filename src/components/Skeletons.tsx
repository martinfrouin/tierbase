// Placeholders shaped like the page that is loading, so content fills in place instead of popping in below a "Loading…"

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Bar({ width, height = 14 }: { width: string; height?: number }) {
  return <span className="skeleton skeleton-bar" style={{ width, height }} />;
}

function Chips({ count = 7 }: { count?: number }) {
  return (
    <span className="skeleton-chips">
      {range(count).map((i) => (
        <span key={i} className="skeleton skeleton-chip" />
      ))}
    </span>
  );
}

export function RecListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ol className="rec-list" aria-hidden>
      {range(rows).map((i) => (
        <li key={i} className="rec">
          <span className="skeleton skeleton-cover" />
          <div className="skeleton-lines">
            <Bar width="45%" height={18} />
            <Bar width="60%" />
            <Bar width="35%" />
            <Chips />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <section className="hero">
        <Bar width="40%" height={36} />
      </section>
      <span className="skeleton skeleton-block" />
      <RecListSkeleton />
    </div>
  );
}

export function TitleSkeleton() {
  return (
    <article className="title-page" aria-busy="true" aria-label="Loading">
      <div className="title-header">
        <span className="skeleton cover-large" />
        <div className="skeleton-lines">
          <Bar width="55%" height={32} />
          <Bar width="40%" />
          <Bar width="30%" />
          <Bar width="95%" />
          <Bar width="90%" />
          <Bar width="70%" />
          <Chips />
        </div>
      </div>
      <h2>
        <Bar width="35%" height={20} />
      </h2>
      <div className="cover-grid">
        {range(6).map((i) => (
          <span key={i} className="skeleton skeleton-tile" />
        ))}
      </div>
    </article>
  );
}

export function RankingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="toolbar">
        <span className="skeleton skeleton-search" />
        <Chips count={4} />
      </div>
      <ol className="ranking">
        {range(10).map((i) => (
          <li key={i} className="ranking-row">
            <Bar width="28px" />
            <span className="skeleton cover-small" />
            <Bar width={`${40 + ((i * 17) % 35)}%`} />
            <span className="ranking-meta" />
            <span className="ranking-meta" />
            <Bar width="28px" />
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TierBoardSkeleton() {
  return (
    <div className="tiers" aria-busy="true" aria-label="Loading">
      {["s", "a", "b", "c", "d"].map((tier) => (
        <div key={tier} className="tier">
          <div className="tier-label" style={{ background: `var(--tier-${tier})`, opacity: 0.4 }} />
          <div className="tier-items" />
        </div>
      ))}
    </div>
  );
}
