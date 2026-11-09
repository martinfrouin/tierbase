import Link from "next/link";
import { universePath, type Universe } from "@/lib/universes";

export default function TierListNudge({ ranked, universe = "reading" }: { ranked: number; universe?: Universe }) {
  const noun = universe === "games" ? "game" : "title";
  return (
    <aside className="nudge">
      <div>
        <strong>The more {noun}s you rank, the better your recommendations</strong>
        <p className="muted">
          {ranked} {noun}
          {ranked === 1 ? "" : "s"} in your tier list. Anything you rank is never recommended again.
        </p>
      </div>
      <Link href={universePath(universe, "/tierlist")} className="button primary">
        Rank more {noun}s
      </Link>
    </aside>
  );
}
