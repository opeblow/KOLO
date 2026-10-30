import Landing from "@/components/landing/Landing";

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
