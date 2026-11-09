import Link from "next/link";
import { universePath, type Universe } from "@/lib/universes";

export default function TierListNudge({ ranked, universe = "reading" }: { ranked: number; universe?: Universe }) {
  return (
    <aside className="nudge">
      <div>
        <strong>The more titles you rank, the better your recommendations</strong>
        <p className="muted">
          {ranked} title{ranked === 1 ? "" : "s"} in your tier list. Anything you rank is never recommended again.
        </p>
      </div>
      <Link href={universePath(universe, "/tierlist")} className="button primary">
        Rank more titles
      </Link>
    </aside>
  );
}
