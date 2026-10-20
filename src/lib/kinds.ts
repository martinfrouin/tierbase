export type Kind = "manhwa" | "manga" | "manhua" | "comic" | "novel";

export const KINDS: { value: Kind; label: string }[] = [
  { value: "manhwa", label: "Manhwa 🇰🇷" },
  { value: "manga", label: "Manga 🇯🇵" },
  { value: "manhua", label: "Manhua 🇨🇳" },
  { value: "comic", label: "Comic" },
  { value: "novel", label: "Novel" },
];

export function parseKind(value: string | null | undefined): Kind | null {
  return KINDS.some((k) => k.value === value) ? (value as Kind) : null;
}
