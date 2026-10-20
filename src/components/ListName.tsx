"use client";

import { useState } from "react";
import { setListName } from "@/app/actions";

export default function ListName({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");

  const save = async () => {
    if (value.trim() === saved.trim()) return;
    await setListName(value);
    setSaved(value);
  };

  return (
    <label className="list-name">
      <span className="muted">Name your list (shown when you share it)</span>
      <input
        className="list-name-input"
        value={value}
        maxLength={60}
        placeholder="e.g. My all-time manhwa"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );
}
