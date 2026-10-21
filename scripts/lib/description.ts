const ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  mdash: "—", ndash: "–", hellip: "…", bull: "•", minus: "−", times: "×", middot: "·", deg: "°", hearts: "♥",
};
const ACCENTS: Record<string, string> = {
  acute: "́", grave: "̀", circ: "̂", uml: "̈", tilde: "̃", cedil: "̧", ring: "̊",
};

// AniList descriptions mix HTML, entities and ~!spoiler!~ blocks
export function cleanDescription(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    // A spoiler opens after a space or line start: "girls~!" is only an exclamation
    .replace(/(^|\s)~![\s\S]*?!~/g, "$1")
    .replace(/<br\s*\/?>?/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-zA-Z])(acute|grave|circ|uml|tilde|cedil|ring);/g, (_, letter, accent) => (letter + ACCENTS[accent]).normalize("NFC"))
    .replace(/&(\w+);/g, (match, name) => ENTITIES[name] ?? match)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || null;
}
