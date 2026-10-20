import { ImageResponse } from "next/og";
import { getLibrary, getUserByShareId, TIERS } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";

export const alt = "Tier list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_COLORS = { S: "#ff7f7f", A: "#ffbf7f", B: "#ffdf7f", C: "#bfff7f", D: "#7fbfff" };
const PER_ROW = 13;

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const owner = await getUserByShareId((await params).shareId);
  const list = owner ? (await getLibrary(owner.id)).filter((e) => e.tier) : [];

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0f1115", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#ecedf0" }}>{owner?.listName ?? "A reader's tier list"}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ff6b4a" }}>{SITE_NAME}</div>
        </div>
        {TIERS.map((tier) => {
          // Covers must be absolute URLs here; locally served ones are skipped
          const covers = list.filter((e) => e.tier === tier && e.title.cover.startsWith("http")).slice(0, PER_ROW);
          return (
            <div key={tier} style={{ display: "flex", height: 100, marginTop: 6, background: "#181b22", borderRadius: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 72,
                  fontSize: 40,
                  fontWeight: 700,
                  color: "#111",
                  background: TIER_COLORS[tier],
                  borderRadius: "8px 0 0 8px",
                }}
              >
                {tier}
              </div>
              <div style={{ display: "flex", gap: 6, padding: 6 }}>
                {covers.map((e) => (
                  <img key={e.title.id} src={e.title.cover} width={62} height={88} style={{ borderRadius: 4, objectFit: "cover" }} alt="" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    ),
    size,
  );
}
