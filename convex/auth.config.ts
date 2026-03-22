import type { AuthConfig } from "convex/server";

// Convex + Clerk: https://docs.convex.dev/auth/clerk
// Convex dashboard: CLERK_JWT_ISSUER_DOMAIN = Clerk JWT template Issuer (Frontend API URL).
// applicationID must match JWT `aud` (usually "convex"). Do not use process.env for audience —
// Convex requires every env var referenced here to exist in the dashboard.
// If your token's `aud` differs (see jwt.io), change the string below and redeploy.
//
// Clerk: https://dashboard.clerk.com/apps/setup/convex — or add claims { "aud": "convex" } on your template.
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
