import Link from "next/link";

export default function TierListNudge({ ranked }: { ranked: number }) {
  return (
    <aside className="nudge">
      <div>
        <strong>The more titles you rank, the better your recommendations</strong>
        <p className="muted">
          {ranked} title{ranked === 1 ? "" : "s"} in your tier list. Anything you rank is never recommended again.
        </p>
      </div>
      <Link href="/tierlist" className="button primary">
        Rank more titles
      </Link>
    </aside>
  );
}
