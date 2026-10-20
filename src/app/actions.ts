"use server";

import { revalidatePath, updateTag } from "next/cache";
import { sql } from "@/lib/db";
import { ensureUserId } from "@/lib/user";
import { RATINGS_TAG, searchTitles, TIERS, type LibraryState, type TitleCard, type Tier } from "@/lib/data";

export async function setEntry(
  titleId: number,
  entry: { tier: Tier } | { state: Exclude<LibraryState, "rated"> } | null,
) {
  const userId = await ensureUserId();
  if (entry === null) {
    await sql`DELETE FROM ratings WHERE user_id = ${userId} AND title_id = ${titleId}`;
  } else {
    const tier = "tier" in entry && TIERS.includes(entry.tier) ? entry.tier : null;
    const state = tier ? "rated" : "state" in entry ? entry.state : null;
    if (!state) throw new Error("Invalid entry");
    await sql`
      INSERT INTO ratings (user_id, title_id, tier, state) VALUES (${userId}, ${titleId}, ${tier}, ${state})
      ON CONFLICT (user_id, title_id) DO UPDATE SET tier = excluded.tier, state = excluded.state, updated_at = now()
    `;
  }
  updateTag(RATINGS_TAG);
  revalidatePath("/for-you");
  revalidatePath("/tierlist");
}

export async function saveFavorites(titleIds: number[]) {
  const userId = await ensureUserId();
  for (const id of titleIds.slice(0, 20)) {
    // Never overrides a tier the reader already chose
    await sql`
      INSERT INTO ratings (user_id, title_id, tier, state) VALUES (${userId}, ${id}, 'S', 'rated')
      ON CONFLICT (user_id, title_id) DO UPDATE SET tier = 'S', state = 'rated', updated_at = now() WHERE ratings.tier IS NULL
    `;
  }
  updateTag(RATINGS_TAG);
  revalidatePath("/for-you");
  revalidatePath("/tierlist");
}

export async function search(query: string): Promise<TitleCard[]> {
  return searchTitles(query.slice(0, 80));
}

export async function setListName(name: string) {
  const userId = await ensureUserId();
  const cleaned = name.trim().slice(0, 60) || null;
  await sql`UPDATE users SET list_name = ${cleaned} WHERE id = ${userId}`;
  revalidatePath("/tierlist");
}
