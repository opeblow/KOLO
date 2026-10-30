import { createH3SSRHandler } from "@agent-native/core/server/ssr-handler";

// The catch-all page route needs at least one path segment, so the public
// landing page at "/" gets its own server-rendered entry.
export default createH3SSRHandler(
  () => import("virtual:react-router/server-build"),
);
