"use server";

import { refresh, revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { applyRestore, createBackup, findRestore } from "@/lib/backups";
import { ensureUserId, setUserCookie } from "@/lib/user";
import { KINDS, type Kind } from "@/lib/kinds";
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
  // Pages the visitor already opened (an empty tier list) would otherwise come back from the client cache
  refresh();
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
  refresh();
}

export async function clearTiers(kind: Kind | null) {
  const userId = await ensureUserId();
  if (kind && !KINDS.some((k) => k.value === kind)) throw new Error("Invalid kind");
  await sql`
    DELETE FROM ratings r USING titles t
    WHERE r.title_id = t.id AND r.user_id = ${userId} AND r.state = 'rated' AND (${kind}::text IS NULL OR t.kind = ${kind})
  `;
  updateTag(RATINGS_TAG);
  revalidatePath("/for-you");
  revalidatePath("/tierlist");
  refresh();
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

export async function saveBackup(): Promise<{ token: string; count: number }> {
  return createBackup(await ensureUserId());
}

export async function restoreBackup(token: string) {
  const restore = await findRestore(token);
  if (!restore) redirect("/tierlist?restore=invalid");
  await applyRestore(restore);
  await setUserCookie(restore.owner);
  updateTag(RATINGS_TAG);
  revalidatePath("/for-you");
  revalidatePath("/tierlist");
  redirect("/tierlist?restore=ok");
}
