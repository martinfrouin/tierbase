"use client";

import { useState } from "react";
import { saveBackup } from "@/app/actions";

export default function RestoreLink() {
  const [status, setStatus] = useState<string | null>(null);

  const copy = async () => {
    setStatus(null);
    const pending = saveBackup().then(({ token, count }) => ({ url: `${window.location.origin}/restore/${token}`, count }));
    try {
      // Safari only allows writing to the clipboard within the click, so hand it the pending link
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": pending.then(({ url }) => new Blob([url], { type: "text/plain" })) }),
      ]);
      const { count } = await pending;
      setStatus(`Link copied: it brings back your ${count} titles as they are now.`);
    } catch {
      setStatus("Couldn't copy the link, try again.");
    }
  };

  return (
    <section className="pool-section restore">
      <h2>Keep your tier list</h2>
      <p className="muted">
        Save a private link to your list as it is now. Open it any time, even months from now, after clearing your
        cookies or on another device, to get this list back. The link only holds a copy: nobody can edit your list
        with it.
      </p>
      <button className="button primary" onClick={copy}>
        Copy restore link
      </button>
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
