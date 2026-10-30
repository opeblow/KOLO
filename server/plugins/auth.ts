import {
  createToolkitAuthPlugin,
  renderAuthPage,
} from "@agent-native/toolkit/app/auth/server";

import { KOLO_MARK_DATA_URL, themeSignInMarkup } from "../lib/auth-theme.js";

export default createToolkitAuthPlugin({
  // "/" is the public landing page; /v/<token> and /m/<token> are the
  // read-only pages members open from WhatsApp without an account.
  workspaceAppPublicPaths: ["/", "/v", "/m"],
  // Their data comes from token-checked, read-only JSON routes.
  publicPaths: ["/api/public"],
  rootAuth: false,
  renderSignInPage: (props) =>
    themeSignInMarkup(
      renderAuthPage({ ...props, brandMarkSrc: KOLO_MARK_DATA_URL, brandMarkLightSrc: KOLO_MARK_DATA_URL }),
    ),
  marketing: {
    appName: "Kolo",
    tagline: "Savings circles, kept honest.",
    description:
      "An AI treasurer for ajo, esusu, tanda, and chama groups, with a ledger every member can verify.",
    features: [
      "Paste bank alerts; Kolo matches every payment to a member",
      "Payout rules the AI can't bend",
      "Members verify the books from a WhatsApp link",
    ],
  },
});
