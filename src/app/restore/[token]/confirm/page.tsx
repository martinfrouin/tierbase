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

  const currentCount = current ? (await getLibrary(current)).length : 0;
  const saved = restore.savedAt
    ? `, saved on ${restore.savedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "";

  return (
    <>
      <section className="hero">
        <h1>Restore this tier list?</h1>
        <p className="muted">
          {currentCount > 0
            ? `This replaces your current tier list (${titles(currentCount)}) with the one in this link (${titles(restore.entries.length)}${saved}).`
            : `This link holds a tier list of ${titles(restore.entries.length)}${saved}. Restore it on this browser?`}
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
