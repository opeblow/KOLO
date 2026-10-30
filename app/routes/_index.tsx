import bricolage from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url";
import inter from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import type { LinksFunction } from "react-router";

import Landing from "@/components/landing/Landing";

// Preload the headline and body fonts so the hero doesn't reflow when they swap in (CLS).
export const links: LinksFunction = () => [
  { rel: "preload", href: bricolage, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: inter, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
];

const TITLE = "Kolo · Savings circles, kept honest";
const DESCRIPTION =
  "An AI treasurer for ajo, esusu, tanda, chama, and susu groups. Kolo matches bank alerts to members, chases late payers, and keeps a ledger every member can verify from WhatsApp.";

export function meta() {
  return [
    { title: TITLE },
    { name: "description", content: DESCRIPTION },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: TITLE },
    { name: "twitter:description", content: DESCRIPTION },
  ];
}

export default function IndexRoute() {
  return <Landing />;
}
