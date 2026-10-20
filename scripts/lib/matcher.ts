export interface CatalogTitle {
  id: number;
  name: string;
  romaji: string | null;
  synonyms: string[];
  popularity: number;
}

export interface WordLists {
  // ~10k most frequent English words
  common: Set<string>;
  // Full English dictionary, used to spot titles that are ordinary words ("Leviathan", "Noblesse")
  dictionary: Set<string>;
}

interface Alias {
  id: number;
  // "anywhere": matched inside any sentence
  // "capitalized": dictionary word, only counts when written with a capital letter or as a whole list item
  // "item": only counts when it makes up a whole list item
  mode: "anywhere" | "capitalized" | "item";
}

const MAX_WORDS = 12;
const ACRONYM_MAX_RANK = 1000;
const COMMON_PHRASE_MAX_RANK = 1500;
const CAPITALIZED_MAX_RANK = 3000;
const LATIN = /^[\p{Script=Latin}\d\s\p{P}\p{S}]+$/u;

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function variants(name: string, words: WordLists): string[] {
  const out = [normalize(name)];
  const subtitle = normalize(name.split(/\s*(?::|\s-\s|\()\s*/)[0]);
  // A one-word prefix like "Fantasy: I, Invincibility…" is a genre label, not the title
  const generic = !subtitle.includes(" ") && (words.dictionary.has(subtitle) || words.common.has(subtitle));
  if (subtitle !== out[0] && !generic) out.push(subtitle);
  for (const v of [...out]) if (v.startsWith("the ")) out.push(v.slice(4));
  return out;
}

export class TitleMatcher {
  private aliases = new Map<string, Alias>();

  constructor(
    catalog: CatalogTitle[],
    words: WordLists,
    overrides: { add: Record<string, string[]>; block: string[] },
  ) {
    const blocked = new Set(overrides.block.map(normalize));
    for (const [id, names] of Object.entries(overrides.add)) {
      for (const n of names) this.aliases.set(normalize(n), { id: Number(id), mode: "anywhere" });
    }

    const byPopularity = [...catalog].sort((a, b) => b.popularity - a.popularity);
    const namesOf = (t: CatalogTitle) => [t.name, t.romaji, ...t.synonyms].filter((n): n is string => !!n && LATIN.test(n));
    const knownTokens = new Set(byPopularity.flatMap((t) => namesOf(t).flatMap((n) => normalize(n).split(" "))));

    byPopularity.forEach((title, rank) => {
      const mainNames = new Set(variants(title.name, words));
      for (const alias of new Set(namesOf(title).flatMap((n) => variants(n, words)))) {
        if (alias.length < 3 || blocked.has(alias) || this.aliases.has(alias)) continue;
        // One-word synonyms like "Name" (Ming) or "Awesome" (Ooh La La) are ordinary chat words
        if (!mainNames.has(alias) && !alias.includes(" ") && words.common.has(alias)) continue;
        this.aliases.set(alias, { id: title.id, mode: this.modeFor(alias, rank, words) });
      }

      if (rank < ACRONYM_MAX_RANK) {
        const tokens = normalize(title.name).split(" ");
        const acronym = tokens.map((w) => w[0]).join("");
        // Skip acronyms that collide with real words or with words used in other titles ("hua", "god")
        const collides = knownTokens.has(acronym) || words.dictionary.has(acronym) || words.common.has(acronym) || this.aliases.has(acronym);
        if (tokens.length >= 3 && !collides && !blocked.has(acronym)) {
          this.aliases.set(acronym, { id: title.id, mode: "anywhere" });
        }
      }
    });
  }

  private modeFor(alias: string, rank: number, words: WordLists): Alias["mode"] {
    const tokens = alias.split(" ");
    if (tokens.length === 1) {
      if (alias.length <= 4 || words.common.has(alias)) return "item";
      if (words.dictionary.has(alias)) return rank < CAPITALIZED_MAX_RANK ? "capitalized" : "item";
      return "anywhere";
    }
    if (tokens.every((w) => words.common.has(w)) && rank > COMMON_PHRASE_MAX_RANK) return "item";
    return "anywhere";
  }

  match(body: string): number[] {
    const found = new Set<number>();

    for (const item of body.split(/\n|,|;|\/|&|\||\band\b|\bor\b/i)) {
      const alias = this.aliases.get(normalize(item).replace(/^\d+\s+/, ""));
      if (alias) found.add(alias.id);
    }

    const tokens = normalize(body).split(" ");
    const consumed = new Set<string>();
    for (let i = 0; i < tokens.length; ) {
      let step = 1;
      for (let len = Math.min(MAX_WORDS, tokens.length - i); len >= 1; len--) {
        const alias = this.aliases.get(tokens.slice(i, i + len).join(" "));
        if (alias?.mode === "anywhere") {
          found.add(alias.id);
          for (const t of tokens.slice(i, i + len)) consumed.add(t);
          step = len;
          break;
        }
      }
      i += step;
    }

    // A lone capitalized word ("Noblesse is the goat"), not one word of a Title Case phrase ("Peerless Dad")
    const words = body.split(/\s+/);
    const startsCapital = (w?: string) => !!w && /^[A-Z]/.test(w);
    words.forEach((raw, i) => {
      const word = raw.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
      if (!/^[A-Z][a-z]{4,}$/.test(word)) return;
      const alias = this.aliases.get(word.toLowerCase());
      if (alias?.mode !== "capitalized" || consumed.has(word.toLowerCase())) return;
      const prev = words[i - 1];
      const inPhrase = (startsCapital(prev) && !/[.!?:,]$/.test(prev)) || (startsCapital(words[i + 1]) && !/[.!?:,]$/.test(raw));
      if (!inPhrase) found.add(alias.id);
    });

    return [...found];
  }
}
