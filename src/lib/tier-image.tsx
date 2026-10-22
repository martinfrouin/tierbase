import { TIERS, type LibraryEntry } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const TIER_COLORS = { S: "#ff7f7f", A: "#ffbf7f", B: "#ffdf7f", C: "#bfff7f", D: "#7fbfff" };

export const WIDTH = 1200;
const PADDING = 32;
const HEADER = 64;
const FOOTER = 48;
const LABEL = 72;
const GAP = 6;
const ROW_MARGIN = 6;

interface Layout {
  coverWidth: number;
  coverHeight: number;
  // Room under each cover for its name; 0 hides names
  caption: number;
  // Covers past this many lines per tier are dropped; the OG card fits one line each in 630px
  maxLines: number;
  // The OG card names the list and the site up top; the downloaded image only credits the site at the bottom
  header: boolean;
  footer: boolean;
}

export const OG_LAYOUT: Layout = { coverWidth: 58, coverHeight: 82, caption: 0, maxLines: 1, header: true, footer: false };
export const DOWNLOAD_LAYOUT: Layout = { coverWidth: 92, coverHeight: 130, caption: 38, maxLines: Infinity, header: false, footer: true };

// Satori needs absolute URLs; covers AniList lacks are served from public/
function coverUrl(cover: string) {
  return cover.startsWith("http") ? cover : `${SITE_URL}${cover}`;
}

function perLine(layout: Layout) {
  return Math.floor((WIDTH - 2 * PADDING - LABEL - 2 * GAP + GAP) / (layout.coverWidth + GAP));
}

function lines(count: number, layout: Layout) {
  return Math.min(layout.maxLines, Math.max(1, Math.ceil(count / perLine(layout))));
}

function tierHeight(count: number, layout: Layout) {
  const n = lines(count, layout);
  return n * (layout.coverHeight + layout.caption) + (n - 1) * GAP + 2 * GAP;
}

export function imageHeight(list: LibraryEntry[], layout: Layout) {
  const tiers = TIERS.reduce((h, t) => h + ROW_MARGIN + tierHeight(list.filter((e) => e.tier === t).length, layout), 0);
  return 2 * PADDING + (layout.header ? HEADER : -ROW_MARGIN) + tiers + (layout.footer ? FOOTER : 0);
}

export function TierImage({ name, list, layout }: { name?: string; list: LibraryEntry[]; layout: Layout }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0f1115", padding: PADDING }}>
      {layout.header && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: HEADER }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#ecedf0" }}>{name}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ff6b4a" }}>{SITE_NAME}</div>
        </div>
      )}
      {TIERS.map((tier, i) => {
        const entries = list.filter((e) => e.tier === tier);
        const covers = entries.slice(0, lines(entries.length, layout) * perLine(layout));
        return (
          <div
            key={tier}
            style={{ display: "flex", height: tierHeight(entries.length, layout), marginTop: layout.header || i > 0 ? ROW_MARGIN : 0, background: "#181b22", borderRadius: 8 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                width: LABEL,
                fontSize: 40,
                fontWeight: 700,
                color: "#111",
                background: TIER_COLORS[tier],
                borderRadius: "8px 0 0 8px",
              }}
            >
              {tier}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", width: WIDTH - 2 * PADDING - LABEL, gap: GAP, padding: GAP }}>
              {covers.map((e) => (
                <div key={e.title.id} style={{ display: "flex", flexDirection: "column", width: layout.coverWidth }}>
                  {/* Rendered by Satori into a PNG, not by the browser */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl(e.title.cover)}
                    width={layout.coverWidth}
                    height={layout.coverHeight}
                    style={{ borderRadius: 4, objectFit: "cover" }}
                    alt=""
                  />
                  {layout.caption > 0 && (
                    <div
                      style={{
                        display: "block",
                        height: layout.caption,
                        paddingTop: 3,
                        fontSize: 13,
                        lineHeight: 1.25,
                        color: "#ecedf0",
                        textAlign: "center",
                        overflow: "hidden",
                        lineClamp: 2,
                      }}
                    >
                      {e.title.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {layout.footer && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", height: FOOTER, fontSize: 24, color: "#9aa0ab" }}>
          Make yours at {SITE_URL.replace("https://", "")}
        </div>
      )}
    </div>
  );
}
