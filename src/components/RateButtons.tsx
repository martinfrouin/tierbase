"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setEntry } from "@/app/actions";
import type { LibraryState, Tier } from "@/lib/data";
import { UNIVERSE_CONFIG, universePath, type Universe } from "@/lib/universes";

type Choice = {
  emoji: string;
  // Missing for "want", labelled per universe: "Want to read" / "Want to play"
  label?: string;
  entry: { tier: Tier } | { state: Exclude<LibraryState, "rated"> };
};

const CHOICES: Choice[] = [
  { emoji: "⭐", label: "Loved", entry: { tier: "S" } },
  { emoji: "❤️", label: "Liked", entry: { tier: "A" } },
  { emoji: "👍", label: "Good", entry: { tier: "B" } },
  { emoji: "😐", label: "Okay", entry: { tier: "C" } },
  { emoji: "👎", label: "Disliked", entry: { tier: "D" } },
  { emoji: "🧐", entry: { state: "want" } },
  { emoji: "🚫", label: "Not for me", entry: { state: "skip" } },
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

  const isCurrent = ({ entry }: Choice) =>
    !!current && ("tier" in entry ? current.tier === entry.tier : current.state === entry.state);

  const choose = (choice: Choice) =>
    startTransition(async () => {
      await setEntry(titleId, isCurrent(choice) ? null : choice.entry);
      router.refresh();
    });

  return (
    <>
      <div className={pending ? "rate-buttons pending" : "rate-buttons"}>
        {CHOICES.map((choice) => (
          <button
            key={choice.emoji}
            className={isCurrent(choice) ? "chip active" : "chip"}
            disabled={pending}
            onClick={() => choose(choice)}
          >
            <span aria-hidden>{choice.emoji}</span> {choice.label ?? config.want}
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
