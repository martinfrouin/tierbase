import Link from "next/link";

const GOAL = 20;

export default function TierListNudge({ ranked }: { ranked: number }) {
  const done = ranked >= GOAL;
  return (
    <aside className="nudge">
      <div>
        <strong>
          {done ? "Your recommendations are well tuned" : "Your recommendations get sharper with every title you rank"}
        </strong>
        <p className="muted">
          {done
            ? `${ranked} titles ranked. Keep your tier list up to date as you read: what you rank S or A drives your picks, and anything you rank is never recommended again.`
            : `${ranked} of ${GOAL} titles ranked. Rank what you've already read, including what you didn't like, so we stop suggesting it and learn what you really love.`}
        </p>
        <div className="nudge-bar" aria-hidden>
          <span style={{ width: `${Math.min(100, (ranked / GOAL) * 100)}%` }} />
        </div>
      </div>
      <Link href="/tierlist" className="button primary">
        {done ? "Open my tier list" : "Rank more titles"}
      </Link>
    </aside>
  );
}
