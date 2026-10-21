import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { restoreBackup } from "@/app/actions";
import RestoreLink from "@/components/RestoreLink";
import { findRestore } from "@/lib/backups";
import { getLibrary } from "@/lib/data";
import { currentUserId } from "@/lib/user";

export const metadata: Metadata = { title: "Restore a tier list", robots: { index: false } };

const titles = (n: number) => `${n} title${n === 1 ? "" : "s"}`;

async function Confirm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [restore, current] = await Promise.all([findRestore(token), currentUserId()]);
  if (!restore) redirect("/tierlist?restore=invalid");

  const ownerCount = restore.entries ? restore.entries.length : (await getLibrary(restore.owner)).length;
  const currentCount = current ? (await getLibrary(current)).length : 0;
  const saved = restore.savedAt
    ? ` from ${restore.savedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "";
  const sameList = current === restore.owner;

  return (
    <>
      <section className="hero">
        <h1>Restore this tier list?</h1>
        <p className="muted">
          {sameList
            ? `Your tier list changed since this backup${saved}: it has ${titles(currentCount)} now, the backup has ${titles(ownerCount)}. Restoring brings back the list as it was in the backup.`
            : currentCount > 0
              ? `This browser already has a tier list (${titles(currentCount)}). Restoring opens the linked list (${titles(ownerCount)}) instead: save a restore link for your current list first if you want to come back to it.`
              : `The linked list changed since this backup${saved}. Restoring brings back its ${titles(ownerCount)} as they were in the backup.`}
        </p>
      </section>
      <div className="tierlist-actions">
        <form action={restoreBackup.bind(null, token)}>
          <button className="button primary">Restore</button>
        </form>
        <Link className="button" href="/tierlist">
          {currentCount > 0 ? "Keep my current list" : "Cancel"}
        </Link>
      </div>
      {currentCount > 0 && <RestoreLink />}
    </>
  );
}

export default function ConfirmRestorePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Confirm params={params} />
    </Suspense>
  );
}
