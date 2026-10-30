import { createError, defineEventHandler, getRouterParam, setResponseHeader } from "h3";

import { isToken, memberByToken, publicCircleBundle } from "../../../../lib/public-view.js";

/** A member's personal page: the circle bundle plus which member they are. */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  if (!isToken(token)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const found = await memberByToken(token);
  if (!found || found.circle.status === "draft") throw createError({ statusCode: 404, statusMessage: "Not found" });
  setResponseHeader(event, "Cache-Control", "no-store");
  setResponseHeader(event, "X-Robots-Tag", "noindex");
  return {
    ...(await publicCircleBundle(found.circle)),
    you: { memberId: found.member.id, name: found.member.name },
    circleToken: found.circle.publicToken,
  };
});
