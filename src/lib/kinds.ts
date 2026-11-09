export type Kind = "manhwa" | "manga" | "manhua" | "game";

// Reading kinds, which are also the Reading filters
export const KINDS: { value: Kind; label: string }[] = [
  { value: "manhwa", label: "Manhwa 🇰🇷" },
  { value: "manga", label: "Manga 🇯🇵" },
  { value: "manhua", label: "Manhua 🇨🇳" },
];

const GAME_LABEL = "Game 🎮";

export function kindLabel(kind: Kind): string {
  return kind === "game" ? GAME_LABEL : (KINDS.find((k) => k.value === kind)?.label ?? kind);
}

export function parseKind(value: string | null | undefined): Kind | null {
  return KINDS.some((k) => k.value === value) ? (value as Kind) : null;
}
