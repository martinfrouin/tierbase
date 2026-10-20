export type Kind = "manhwa" | "manga" | "manhua";

export const KINDS: { value: Kind; label: string }[] = [
  { value: "manhwa", label: "Manhwa 🇰🇷" },
  { value: "manga", label: "Manga 🇯🇵" },
  { value: "manhua", label: "Manhua 🇨🇳" },
];

export function parseKind(value: string | null | undefined): Kind | null {
  return KINDS.some((k) => k.value === value) ? (value as Kind) : null;
}
