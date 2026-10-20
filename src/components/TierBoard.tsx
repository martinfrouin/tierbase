"use client";

import { useRef, useState } from "react";
import { search, setEntry } from "@/app/actions";
import type { TitleCard, Tier } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const POOL = "pool";
type Slot = Tier | typeof POOL;

interface Props {
  placed: { title: TitleCard; tier: Tier }[];
  pool: TitleCard[];
  editable: boolean;
  shareUrl?: string;
}

export default function TierBoard({ placed, pool: initialPool, editable, shareUrl }: Props) {
  const [tiers, setTiers] = useState<Record<Tier, TitleCard[]>>(() => {
    const byTier = { S: [], A: [], B: [], C: [], D: [] } as Record<Tier, TitleCard[]>;
    for (const { title, tier } of placed) byTier[tier].push(title);
    return byTier;
  });
  const [pool, setPool] = useState(initialPool);
  const [selected, setSelected] = useState<TitleCard | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const latestQuery = useRef("");

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const find = (id: number) => [...Object.values(tiers).flat(), ...pool].find((t) => t.id === id);

  const move = (title: TitleCard, target: Slot) => {
    setTiers((prev) => {
      const next = Object.fromEntries(TIERS.map((t) => [t, prev[t].filter((x) => x.id !== title.id)])) as Record<Tier, TitleCard[]>;
      if (target !== POOL) next[target].push(title);
      return next;
    });
    setPool((prev) => {
      const rest = prev.filter((x) => x.id !== title.id);
      return target === POOL ? [title, ...rest] : rest;
    });
    setSelected(null);
    setEntry(title.id, target === POOL ? null : { tier: target }).catch(() => notify("Couldn't save, try again"));
  };

  const dropProps = (target: Slot) =>
    editable
      ? {
          onDragOver: (e: React.DragEvent) => e.preventDefault(),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const title = find(Number(e.dataTransfer.getData("text/plain")));
            if (title) move(title, target);
          },
          onClick: () => selected && move(selected, target),
        }
      : {};

  const card = (title: TitleCard) => (
    <span
      key={title.id}
      className={selected?.id === title.id ? "card selected" : "card"}
      draggable={editable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(title.id))}
      onClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        setSelected(selected?.id === title.id ? null : title);
      }}
    >
      {title.name}
    </span>
  );

  const onSearch = async (value: string) => {
    setQuery(value);
    latestQuery.current = value;
    if (value.trim().length < 2) return;
    const found = await search(value);
    if (latestQuery.current !== value) return;
    const placedIds = new Set(Object.values(tiers).flat().map((t) => t.id));
    setPool((prev) => [...found.filter((t) => !placedIds.has(t.id)), ...prev.filter((p) => !found.some((f) => f.id === p.id))]);
  };

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      notify("Copy failed");
    }
  };

  const markdown = () =>
    [
      ...TIERS.map((t) => `**${t}:** ${tiers[t].map((x) => x.name).join(", ") || "—"}`),
      `*Made with [${SITE_NAME}](${shareUrl ?? window.location.origin})*`,
    ].join("\n\n");

  const hasPlaced = TIERS.some((t) => tiers[t].length);

  return (
    <>
      {hasPlaced && (
        <div className="tierlist-actions">
          {shareUrl && (
            <button className="button primary" onClick={() => copy(shareUrl, "Link copied")}>
              Copy share link
            </button>
          )}
          <button className="button" onClick={() => copy(markdown(), "Markdown copied")}>
            Copy for Reddit
          </button>
        </div>
      )}

      <div className="tiers">
        {TIERS.map((tier) => (
          <div key={tier} className="tier">
            <div className="tier-label" style={{ background: `var(--tier-${tier.toLowerCase()})` }}>
              {tier}
            </div>
            <div className={selected ? "tier-items target" : "tier-items"} {...dropProps(tier)}>
              {tiers[tier].map(card)}
            </div>
          </div>
        ))}
      </div>

      {editable && (
        <section className="pool-section">
          <input
            className="search"
            type="search"
            placeholder="Search a title to add…"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
          />
          <p className="muted">Drag titles into a tier, or tap a title then tap a tier. Drop back here to remove.</p>
          <div className="pool" {...dropProps(POOL)}>
            {pool.map(card)}
          </div>
        </section>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
