import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  // absolute: the root layout's "%s · TierBase" template would otherwise apply to this default too
  title: { absolute: `${SITE_NAME} — find your next manhwa, manga or manhua`, template: `%s · ${SITE_NAME}` },
  description: "Personal manga, manhwa and manhua recommendations built from what Reddit readers actually recommend.",
};

export default function ReadingLayout({ children }: LayoutProps<"/reading">) {
  return children;
}
