import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

registerShareableResource({
  type: "circle",
  resourceTable: schema.circles,
  sharesTable: schema.circleShares,
  displayName: "Circle",
  titleColumn: "name",
  getResourcePath: (circle) => `/circles/${circle.id}`,
  getDb,
  // Members verify through the public token page, never through share
  // visibility, so a "public" circle would only leak organizer data.
  allowPublic: false,
});
