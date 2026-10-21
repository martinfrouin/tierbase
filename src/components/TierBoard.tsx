"use client";

import { track } from "@vercel/analytics";
import Image from "next/image";
import { useRef, useState } from "react";
import { clearTiers, search, setEntry } from "@/app/actions";
import type { TitleCard, Tier } from "@/lib/data";
import { KINDS, type Kind } from "@/lib/kinds";
import { SITE_NAME } from "@/lib/site";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const POOL = "pool";
const WANT = "want";
type Slot = Tier | typeof POOL | typeof WANT;

interface Props {
  placed: { title: TitleCard; tier: Tier }[];
  wantToRead?: TitleCard[];
  pool: TitleCard[];
  editable: boolean;
  shareUrl?: string;
}

export default function TierBoard({ placed, wantToRead = [], pool: initialPool, editable, shareUrl }: Props) {
  const [tiers, setTiers] = useState<Record<Tier, TitleCard[]>>(() => {
    const byTier = { S: [], A: [], B: [], C: [], D: [] } as Record<Tier, TitleCard[]>;
    for (const { title, tier } of placed) byTier[tier].push(title);
    return byTier;
  });
  const [want, setWant] = useState(wantToRead);
  const [pool, setPool] = useState(initialPool);
  const [selected, setSelected] = useState<TitleCard | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const latestQuery = useRef("");

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const find = (id: number) => [...Object.values(tiers).flat(), ...want, ...pool].find((t) => t.id === id);

  const move = (title: TitleCard, target: Slot) => {
    setTiers((prev) => {
      const next = Object.fromEntries(TIERS.map((t) => [t, prev[t].filter((x) => x.id !== title.id)])) as Record<Tier, TitleCard[]>;
      if (target !== POOL && target !== WANT) next[target].push(title);
      return next;
    });
    const withoutTitle = (list: TitleCard[]) => list.filter((x) => x.id !== title.id);
    setWant((prev) => (target === WANT ? [title, ...withoutTitle(prev)] : withoutTitle(prev)));
    setPool((prev) => (target === POOL ? [title, ...withoutTitle(prev)] : withoutTitle(prev)));
    setSelected(null);
    const entry = target === POOL ? null : target === WANT ? { state: "want" as const } : { tier: target };
    setEntry(title.id, entry).catch(() => notify("Couldn't save, try again"));
  };

  const clear = async () => {
    setConfirmClear(false);
    const cleared = [...TIERS.flatMap((t) => shown(tiers[t])), ...shown(want)];
    const clearedIds = new Set(cleared.map((t) => t.id));
    setTiers((prev) => Object.fromEntries(TIERS.map((t) => [t, prev[t].filter((x) => !clearedIds.has(x.id))])) as Record<Tier, TitleCard[]>);
    setWant((prev) => prev.filter((x) => !clearedIds.has(x.id)));
    setPool((prev) => [...cleared, ...prev]);
    try {
      await clearTiers(kind);
      track("Tier list cleared", { kind: kind ?? "all" });
    } catch {
      notify("Couldn't clear, try again");
    }
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
      {title.cover && <Image className="card-cover" src={title.cover} alt="" width={20} height={28} />}
      {title.name}
    </span>
  );

  const onSearch = async (value: string) => {
    setQuery(value);
    latestQuery.current = value;
    if (value.trim().length < 2) return;
    const found = await search(value);
    if (latestQuery.current !== value) return;
    const placedIds = new Set([...Object.values(tiers).flat(), ...want].map((t) => t.id));
    setPool((prev) => [...found.filter((t) => !placedIds.has(t.id)), ...prev.filter((p) => !found.some((f) => f.id === p.id))]);
  };

  const copy = async (text: string, message: string, event: string) => {
    try {
      await navigator.clipboard.writeText(text);
      track(event, { kind: kind ?? "all" });
      notify(message);
    } catch {
      notify("Copy failed");
    }
  };

  const markdown = () =>
    [
      ...TIERS.map((t) => `**${t}:** ${shown(tiers[t]).map((x) => x.name).join(", ") || "—"}`),
      `*Made with [${SITE_NAME}](${filteredShareUrl ?? window.location.origin})*`,
    ].join("\n\n");

  const shown = (list: TitleCard[]) => (kind ? list.filter((t) => t.kind === kind) : list);
  const kindsInUse = KINDS.filter((k) => [...Object.values(tiers).flat(), ...want, ...pool].some((t) => t.kind === k.value));
  const hasPlaced = TIERS.some((t) => shown(tiers[t]).length);
  const filteredShareUrl = shareUrl && kind ? `${shareUrl}?kind=${kind}` : shareUrl;

  return (
    <>
      {hasPlaced && (
        <div className="tierlist-actions">
          {filteredShareUrl && (
            <button className="button primary" onClick={() => copy(filteredShareUrl, "Link copied", "Share link copied")}>
              Copy share link
            </button>
          )}
          <button className="button" onClick={() => copy(markdown(), "Markdown copied", "Reddit markdown copied")}>
            Copy for Reddit
          </button>
          {editable &&
            (confirmClear ? (
              <span className="clear-confirm">
                <button className="button danger" onClick={clear}>
                  Remove {TIERS.reduce((n, t) => n + shown(tiers[t]).length, shown(want).length)} titles
                </button>
                <button className="button" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className="button clear-button" onClick={() => setConfirmClear(true)}>
                {kind ? `Clear ${KINDS.find((k) => k.value === kind)?.label} tiers` : "Clear tier list"}
              </button>
            ))}
        </div>
      )}

      {kindsInUse.length > 1 && (
        <div className="chips board-filter">
          <button className={kind ? "chip" : "chip active"} onClick={() => setKind(null)}>
            All
          </button>
          {kindsInUse.map((k) => (
            <button key={k.value} className={kind === k.value ? "chip active" : "chip"} onClick={() => setKind(kind === k.value ? null : k.value)}>
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="tiers">
        {TIERS.map((tier) => (
          <div key={tier} className="tier">
            <div className="tier-label" style={{ background: `var(--tier-${tier.toLowerCase()})` }}>
              {tier}
            </div>
            <div className={selected ? "tier-items target" : "tier-items"} {...dropProps(tier)}>
              {shown(tiers[tier]).map(card)}
            </div>
          </div>
        ))}
      </div>

      {editable && (
        <>
          <p className="muted board-help">Drag a title into a tier, or tap it then tap a tier.</p>

          <section className="pool-section">
            <h2>
              Want to read <span className="muted">({want.length})</span>
            </h2>
            <div className={selected ? "pool want target" : "pool want"} {...dropProps(WANT)}>
              {want.length === 0 ? (
                <span className="muted pool-empty">Titles you mark &quot;Want to read&quot; land here, ready to rank once you&apos;ve read them.</span>
              ) : (
                shown(want).map(card)
              )}
            </div>
          </section>

          <section className="pool-section">
            <h2>Add more titles</h2>
            <input
              className="search"
              type="search"
              placeholder="Search any title…"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
            />
            <div className={selected ? "pool target" : "pool"} {...dropProps(POOL)}>
              {shown(pool).map(card)}
            </div>
            <p className="muted">Drop a title back here to remove it from your list.</p>
          </section>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
