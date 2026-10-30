import { useParams } from "react-router";

import { PublicCircle } from "@/components/public/PublicCircle";

export function meta() {
  return [{ title: "Your circle · Kolo" }, { name: "robots", content: "noindex" }];
}

export default function MemberRoute() {
  const { token = "" } = useParams();
  return <PublicCircle endpoint={`/api/public/member/${encodeURIComponent(token)}`} />;
}
