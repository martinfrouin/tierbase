import { mailAutoconfigResponse } from "@/lib/mail-autoconfig";

export function GET() {
  return mailAutoconfigResponse();
}
