"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setEntry } from "@/app/actions";
import type { LibraryState, Tier } from "@/lib/data";

type Choice = {
  emoji: string;
  label: string;
  entry: { tier: Tier } | { state: Exclude<LibraryState, "rated"> };
};

const CHOICES: Choice[] = [
  { emoji: "⭐", label: "Loved it", entry: { tier: "S" } },
  { emoji: "❤️", label: "Liked it", entry: { tier: "A" } },
  { emoji: "👍", label: "Good", entry: { tier: "B" } },
  { emoji: "😐", label: "It was ok", entry: { tier: "C" } },
  { emoji: "👎", label: "Didn't like it", entry: { tier: "D" } },
  { emoji: "🧐", label: "Want to read", entry: { state: "want" } },
  { emoji: "🚫", label: "Not for me", entry: { state: "skip" } },
];

interface Props {
  titleId: number;
  current?: { tier: Tier | null; state: LibraryState } | null;
}

export default function RateButtons({ titleId, current }: Props) {
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
            key={choice.label}
            className={isCurrent(choice) ? "chip active" : "chip"}
            disabled={pending}
            onClick={() => choose(choice)}
          >
            <span aria-hidden>{choice.emoji}</span> {choice.label}
          </button>
        ))}
      </div>
      {current?.tier && (
        <Link href="/tierlist" className="rate-note">
          Saved in your tier list as {current.tier}. Rank more to sharpen your recommendations →
        </Link>
      )}
    </>
  );
}
