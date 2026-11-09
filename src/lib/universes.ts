export type Universe = "reading" | "games";

export const UNIVERSES: Universe[] = ["reading", "games"];

export function parseUniverse(value: string | null | undefined): Universe | null {
  return UNIVERSES.includes(value as Universe) ? (value as Universe) : null;
}
