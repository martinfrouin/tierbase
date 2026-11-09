"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { search } from "@/app/actions";
import Cover from "@/components/Cover";
import type { TitleCard } from "@/lib/data";
import { kindLabel } from "@/lib/kinds";
import { titleHref } from "@/lib/universes";

const DEBOUNCE_MS = 200;
const MAX_RESULTS = 8;

export default function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TitleCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = () => {
    clearTimeout(timer.current);
    latest.current = "";
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearching(false);
    setActive(0);
  };

  // "/" (outside a text field) and Cmd/Ctrl+K open the search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    latest.current = value;
    clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const found = await search(value, ["reading", "games"]);
        if (latest.current !== value) return;
        setResults(found.slice(0, MAX_RESULTS));
        setActive(0);
      } finally {
        if (latest.current === value) setSearching(false);
      }
    }, DEBOUNCE_MS);
  };

  const go = (title: TitleCard) => {
    close();
    router.push(titleHref(title));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <>
      <button type="button" className="search-button" aria-label="Search titles" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      {open && (
        <div className="search-overlay" onClick={close}>
          <div className="search-panel" role="dialog" aria-label="Search titles" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="search"
              placeholder="Search manga, manhwa, manhua or games…"
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="header-search-results"
              aria-activedescendant={results[active] ? `header-search-${results[active].id}` : undefined}
            />
            {results.length > 0 && (
              <ul id="header-search-results" className="search-results" role="listbox">
                {results.map((t, i) => (
                  <li
                    key={t.id}
                    id={`header-search-${t.id}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? "active" : undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(t)}
                  >
                    <Cover src={t.cover} size="small" />
                    <span>
                      {t.name}
                      {t.year && t.universe === "games" && <span className="muted"> ({t.year})</span>}
                    </span>
                    <small className="muted">{kindLabel(t.kind)}</small>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="muted search-empty">
                No match. Missing title?{" "}
                <Link href="/contact" onClick={close}>
                  Tell me
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
