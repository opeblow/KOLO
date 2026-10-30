import { useParams } from "react-router";

import { PublicCircle } from "@/components/public/PublicCircle";

export function meta() {
  return [{ title: "Verify a circle · Kolo" }, { name: "robots", content: "noindex" }];
}

export default function VerifyRoute() {
  const { token = "" } = useParams();
  return <PublicCircle endpoint={`/api/public/circle/${encodeURIComponent(token)}`} />;
}
