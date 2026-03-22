import type { AuthConfig } from "convex/server";

// Convex + Clerk: https://docs.convex.dev/auth/clerk
// Set CLERK_JWT_ISSUER_DOMAIN in the Convex dashboard (Clerk Frontend API URL, e.g. https://xxx.clerk.accounts.dev).
// applicationID must match the Clerk JWT template name: "convex".
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
