"use client";

import { useState } from "react";

const PREVIEW_LENGTH = 320;

export default function Synopsis({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > PREVIEW_LENGTH;
  return (
    <div className="synopsis">
      <p className={long && !expanded ? "clamped" : undefined}>{text}</p>
      {long && (
        <button className="link-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
