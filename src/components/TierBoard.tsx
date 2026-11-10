"use client";

import { track } from "@vercel/analytics";
import Image from "next/image";
import { useRef, useState } from "react";
import { clearTiers, search, setEntry } from "@/app/actions";
import type { TitleCard, Tier } from "@/lib/data";
import FilterMenu from "@/components/FilterMenu";
import { filtersInUse, filtersLabel, filtersQuery, matchesFilters } from "@/lib/list-filters";
import { filterParams, type TitleFilters } from "@/lib/title-filters";
import { UNIVERSE_CONFIG, type Universe } from "@/lib/universes";

const TIERS: Tier[] = ["S", "A", "B", "C", "D"];
const POOL = "pool";
// Suggestions shown at once in "Add more titles", out of a deeper pool so filters keep enough
const POOL_SHOWN = 60;
const WANT = "want";
type Slot = Tier | typeof POOL | typeof WANT;

interface Props {
  placed: { title: TitleCard; tier: Tier }[];
  wantToRead?: TitleCard[];
  pool: TitleCard[];
  editable: boolean;
  shareUrl?: string;
  universe?: Universe;
}

export default function TierBoard({
  placed,
  wantToRead = [],
  pool: initialPool,
  editable,
  shareUrl,
  universe = "reading",
}: Props) {
  const config = UNIVERSE_CONFIG[universe];
  const [tiers, setTiers] = useState<Record<Tier, TitleCard[]>>(() => {
    const byTier = { S: [], A: [], B: [], C: [], D: [] } as Record<Tier, TitleCard[]>;
    for (const { title, tier } of placed) byTier[tier].push(title);
    return byTier;
  });
  const [want, setWant] = useState(wantToRead);
  const [pool, setPool] = useState(initialPool);
  const [selected, setSelected] = useState<TitleCard | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TitleFilters>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const latestQuery = useRef("");

  const filterQuery = filtersQuery(filter);
  const filterLabel = filtersLabel(filter);
  // Analytics: "all", "manhwa", "romance manhwa"
  const filterName = filterLabel?.toLowerCase() ?? "all";

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
      await clearTiers(filterParams(filter), universe);
      track("Tier list cleared", { filter: filterName, universe });
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
    const found = await search(value, [universe]);
    if (latestQuery.current !== value) return;
    const placedIds = new Set([...Object.values(tiers).flat(), ...want].map((t) => t.id));
    setPool((prev) => [...found.filter((t) => !placedIds.has(t.id)), ...prev.filter((p) => !found.some((f) => f.id === p.id))]);
  };

  const copy = async (text: string, message: string, event: string) => {
    try {
      await navigator.clipboard.writeText(text);
      track(event, { filter: filterName, universe });
      notify(message);
    } catch {
      notify("Copy failed");
    }
  };

  // Fetched rather than linked so the button can show progress: rendering every cover takes a few seconds
  const downloadImage = async () => {
    if (!shareUrl) return;
    setGenerating(true);
    try {
      const response = await fetch(`${shareUrl}/image${filterQuery}`);
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "tier-list.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      track("Image downloaded", { filter: filterName, universe });
    } catch {
      notify("Couldn't generate the image");
    } finally {
      setGenerating(false);
    }
  };

  const shown = (list: TitleCard[]) => list.filter((t) => matchesFilters(filter, t));
  // Offered from what is ranked, so "Roguelite" only shows up once a roguelite is in the list
  const options = filtersInUse(universe, [...Object.values(tiers).flat(), ...want]);
  const hasPlaced = TIERS.some((t) => shown(tiers[t]).length);
  const filteredShareUrl = shareUrl && `${shareUrl}${filterQuery}`;

  return (
    <>
      {hasPlaced && (
        <div className="tierlist-actions">
          {filteredShareUrl && (
            <button className="button primary" onClick={() => copy(filteredShareUrl, "Link copied", "Share link copied")}>
              Copy share link
            </button>
          )}
          {shareUrl && (
            <button className="button" onClick={downloadImage} disabled={generating} aria-busy={generating}>
              {generating ? (
                <>
                  <span className="spinner" aria-hidden /> Generating image…
                </>
              ) : (
                "Download image"
              )}
            </button>
          )}
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
                {filterLabel ? `Clear ${filterLabel} tiers` : "Clear tier list"}
              </button>
            ))}
        </div>
      )}

      {(options.kinds.length > 1 || options.genres.length > 0) && (
        <div className="filter-bar">
          <FilterMenu
            kinds={options.kinds.length > 1 ? options.kinds : []}
            genres={options.genres}
            active={filter}
            onSelect={setFilter}
          />
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
              {config.want} <span className="muted">({shown(want).length})</span>
            </h2>
            <div className={selected ? "pool want target" : "pool want"} {...dropProps(WANT)}>
              {want.length === 0 ? (
                <span className="muted pool-empty">
                  Titles you mark &quot;{config.want}&quot; land here, ready to rank once you&apos;ve {config.past} them.
                </span>
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
              {shown(pool).slice(0, POOL_SHOWN).map(card)}
            </div>
            <p className="muted">Drop a title back here to remove it from your list.</p>
          </section>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
