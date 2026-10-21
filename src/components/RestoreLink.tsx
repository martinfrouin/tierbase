"use client";

import { useState } from "react";

export default function RestoreLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <section className="pool-section restore">
      <h2>Keep your tier list</h2>
      <p className="muted">
        Your list is tied to this browser. Save this private link to get it back on another device or after clearing
        your cookies. Don&apos;t share it: anyone with it can edit your list.
      </p>
      <div className="restore-row">
        <input className="list-name-input restore-input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button className="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}
