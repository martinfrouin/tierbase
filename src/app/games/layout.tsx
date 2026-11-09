import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  // absolute: the root layout's "%s · TierBase" template would otherwise apply to this default too
  title: { absolute: `${SITE_NAME} — find your next game`, template: `%s · ${SITE_NAME}` },
  description: "Personal video game recommendations and tier lists built from what Reddit players actually recommend.",
};

export default function GamesLayout({ children }: LayoutProps<"/games">) {
  return children;
}
