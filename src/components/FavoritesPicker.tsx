"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import Cover from "@/components/Cover";
import { saveFavorites, search } from "@/app/actions";
import type { TitleCard } from "@/lib/data";

const MIN_PICKS = 3;

export default function FavoritesPicker({ suggestions }: { suggestions: TitleCard[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<TitleCard[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TitleCard[] | null>(null);
  const [saving, startSaving] = useTransition();
  const latestQuery = useRef("");

  const pickedIds = new Set(picked.map((t) => t.id));
  const toggle = (title: TitleCard) =>
    setPicked((prev) => (pickedIds.has(title.id) ? prev.filter((t) => t.id !== title.id) : [...prev, title]));

  const onSearch = async (value: string) => {
    setQuery(value);
    latestQuery.current = value;
    if (value.trim().length < 2) return setResults(null);
    const found = await search(value);
    // Ignore responses for a query the user already moved past
    if (latestQuery.current === value) setResults(found);
  };

  const submit = () =>
    startSaving(async () => {
      await saveFavorites(picked.map((t) => t.id));
      router.push("/for-you");
    });

  const grid = results ?? suggestions;

  return (
    <section>
      <div className="picker-bar">
        <input
          className="search"
          type="search"
          placeholder="Search any manga, manhwa or manhua…"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
        />
        <button className="button primary" disabled={picked.length < MIN_PICKS || saving} onClick={submit}>
          {saving
            ? "Finding your next reads…"
            : picked.length < MIN_PICKS
              ? `Pick ${MIN_PICKS - picked.length} more`
              : `Get my recommendations (${picked.length})`}
        </button>
      </div>

      {picked.length > 0 && (
        <div className="chips picked">
          {picked.map((t) => (
            <button key={t.id} className="chip active" onClick={() => toggle(t)}>
              {t.name} ✕
            </button>
          ))}
        </div>
      )}

      <div className="cover-grid">
        {grid.map((t) => (
          <button
            key={t.id}
            className={pickedIds.has(t.id) ? "cover-tile selected" : "cover-tile"}
            onClick={() => toggle(t)}
            aria-pressed={pickedIds.has(t.id)}
          >
            <Cover src={t.cover} size="medium" />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      {results?.length === 0 && <p className="muted">No title found.</p>}
    </section>
  );
}
