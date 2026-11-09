export const SUBJECTS = ["missing-title", "bug", "other"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const MAX_BODY = 4000;

export interface ContactValues {
  subject: string;
  body: string;
  email: string;
}

export interface ContactState {
  status: "idle" | "sent" | "error";
  message: string;
  // React resets the form after an action: errors send the typed values back so nothing is lost
  values?: ContactValues;
  // Changes on every error so the form remounts with these values
  attempt?: number;
}
