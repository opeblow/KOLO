import { createError, defineEventHandler, getRouterParam, setResponseHeader } from "h3";

import { circleByPublicToken, isToken, publicCircleBundle } from "../../../../lib/public-view.js";

/** Read-only circle bundle for the public verification page. */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  if (!isToken(token)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const circle = await circleByPublicToken(token);
  if (!circle || circle.status === "draft") throw createError({ statusCode: 404, statusMessage: "Not found" });
  setResponseHeader(event, "Cache-Control", "no-store");
  setResponseHeader(event, "X-Robots-Tag", "noindex");
  return publicCircleBundle(circle);
});
