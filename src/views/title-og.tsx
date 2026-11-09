/* eslint-disable @next/next/no-img-element -- Satori (ImageResponse) only renders plain <img> */
import { ImageResponse } from "next/og";
import { getTitle, similarTitles } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { UNIVERSE_CONFIG, type Universe } from "@/lib/universes";

export const TITLE_OG_SIZE = { width: 1200, height: 630 };

const SIMILAR = 5;

function absolute(cover: string) {
  return cover.startsWith("http") ? cover : `${SITE_URL}${cover}`;
}

// Shown when a title page is pasted on Reddit, Discord or X: the cover, then what people loved next
export async function titleOgImage(universe: Universe, slug: string) {
  const title = await getTitle(slug, universe);
  const similar = title ? (await similarTitles(title.id)).slice(0, SIMILAR) : [];
  const people = UNIVERSE_CONFIG[universe].people;
  const kind = title ? title.kind[0].toUpperCase() + title.kind.slice(1) : "";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0f1115", padding: 48, gap: 48 }}>
        {title && <img src={absolute(title.cover)} width={370} height={534} style={{ borderRadius: 12, objectFit: "cover" }} alt="" />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 700 }}>
            <span style={{ color: "#9aa0ab" }}>{kind}</span>
            <span style={{ color: "#ff6b4a" }}>{SITE_NAME}</span>
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#ecedf0", marginTop: 12, lineHeight: 1.1 }}>
            {title?.name ?? SITE_NAME}
          </div>
          {similar.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
              {/* One text child: Satori rejects a <div> with several children unless it is display: flex */}
              <div style={{ fontSize: 26, color: "#9aa0ab", marginBottom: 14 }}>
                {`${people[0].toUpperCase() + people.slice(1)} who loved it also loved`}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {similar.map((r) => (
                  <div key={r.title.id} style={{ display: "flex", flexDirection: "column", width: 126 }}>
                    <img src={absolute(r.title.cover)} width={126} height={182} style={{ borderRadius: 6, objectFit: "cover" }} alt="" />
                    <div style={{ display: "block", height: 44, paddingTop: 4, fontSize: 16, lineHeight: 1.25, color: "#ecedf0", overflow: "hidden", lineClamp: 2 }}>
                      {r.title.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    TITLE_OG_SIZE,
  );
}
