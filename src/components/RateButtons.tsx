"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setEntry } from "@/app/actions";
import type { LibraryState, Tier } from "@/lib/data";
import { UNIVERSE_CONFIG, universePath, type Universe } from "@/lib/universes";

type Choice =
  | { tier: Tier }
  // Missing label for "want", labelled per universe: "Want to read" / "Want to play"
  | { emoji: string; label?: string; state: Exclude<LibraryState, "rated"> };

const CHOICES: Choice[] = [
  { tier: "S" },
  { tier: "A" },
  { tier: "B" },
  { tier: "C" },
  { tier: "D" },
  { emoji: "🧐", state: "want" },
  { emoji: "🚫", label: "Not for me", state: "skip" },
];

interface Props {
  titleId: number;
  current?: { tier: Tier | null; state: LibraryState } | null;
  universe?: Universe;
}

export default function RateButtons({ titleId, current, universe = "reading" }: Props) {
  const config = UNIVERSE_CONFIG[universe];
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isCurrent = (choice: Choice) =>
    !!current && ("tier" in choice ? current.tier === choice.tier : current.state === choice.state);

  const choose = (choice: Choice) =>
    startTransition(async () => {
      await setEntry(
        titleId,
        isCurrent(choice) ? null : "tier" in choice ? { tier: choice.tier } : { state: choice.state },
      );
      router.refresh();
    });

  return (
    <>
      <div className={pending ? "rate-buttons pending" : "rate-buttons"}>
        {CHOICES.map((choice) => (
          <button
            key={"tier" in choice ? choice.tier : choice.state}
            className={isCurrent(choice) ? "chip active" : "chip"}
            disabled={pending}
            onClick={() => choose(choice)}
          >
            {"tier" in choice ? (
              <span className="tier-badge" style={{ background: `var(--tier-${choice.tier.toLowerCase()})` }}>
                {choice.tier}
              </span>
            ) : (
              <>
                <span aria-hidden>{choice.emoji}</span> {choice.label ?? config.want}
              </>
            )}
          </button>
        ))}
      </div>
      {current?.tier && (
        <Link href={universePath(universe, "/tierlist")} className="rate-note">
          Saved in your tier list as {current.tier}. Rank more to sharpen your recommendations →
        </Link>
      )}
    </>
  );
}
