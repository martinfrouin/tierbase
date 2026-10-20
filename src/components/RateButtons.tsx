"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setEntry } from "@/app/actions";
import type { LibraryState, Tier } from "@/lib/data";

type Choice = { label: string; entry: { tier: Tier } | { state: Exclude<LibraryState, "rated"> } };

const CHOICES: Choice[] = [
  { label: "Loved it", entry: { tier: "S" } },
  { label: "Liked it", entry: { tier: "A" } },
  { label: "It was ok", entry: { tier: "C" } },
  { label: "Didn't like it", entry: { tier: "D" } },
  { label: "Want to read", entry: { state: "want" } },
  { label: "Not for me", entry: { state: "skip" } },
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
    <div className={pending ? "rate-buttons pending" : "rate-buttons"}>
      {CHOICES.map((choice) => (
        <button
          key={choice.label}
          className={isCurrent(choice) ? "chip active" : "chip"}
          disabled={pending}
          onClick={() => choose(choice)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
