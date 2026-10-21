import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { switchToList } from "@/app/actions";
import RestoreLink from "@/components/RestoreLink";
import { getLibrary } from "@/lib/data";
import { currentUserId, getRestoreToken, userIdByRestoreToken } from "@/lib/user";

export const metadata: Metadata = { title: "Open another tier list", robots: { index: false } };

const titles = (n: number) => `${n} title${n === 1 ? "" : "s"}`;

async function Confirm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [target, current] = await Promise.all([userIdByRestoreToken(token), currentUserId()]);
  if (!target) redirect("/tierlist?restore=invalid");
  if (!current || current === target) redirect(`/restore/${token}`);

  const [targetLibrary, currentLibrary, currentToken] = await Promise.all([
    getLibrary(target),
    getLibrary(current),
    getRestoreToken(current),
  ]);
  const host = (await headers()).get("host");
  const origin = host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}` : "";

  return (
    <>
      <section className="hero">
        <h1>Open another tier list?</h1>
        <p className="muted">
          This browser already has a tier list ({titles(currentLibrary.length)}). The link you opened leads to a
          different one ({titles(targetLibrary.length)}). Switching won&apos;t delete your current list, but you&apos;ll
          only get it back with its own restore link below.
        </p>
      </section>
      <div className="tierlist-actions">
        <form action={switchToList.bind(null, token)}>
          <button className="button primary">Switch to the linked list</button>
        </form>
        <Link className="button" href="/tierlist">
          Keep my current list
        </Link>
      </div>
      {currentToken && <RestoreLink url={`${origin}/restore/${currentToken}`} />}
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
