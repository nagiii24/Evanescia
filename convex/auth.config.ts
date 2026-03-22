import type { AuthConfig } from "convex/server";

// Convex + Clerk: https://docs.convex.dev/auth/clerk
// Convex dashboard (this deployment):
//   CLERK_JWT_ISSUER_DOMAIN = Clerk JWT template "Issuer" (Frontend API URL)
// Optional if your JWT's `aud` claim is not the string "convex" (decode at https://jwt.io ):
//   CLERK_JWT_AUDIENCE = exact aud value from the token
//
// Clerk: activate https://dashboard.clerk.com/apps/setup/convex so `aud` is pre-mapped for Convex,
// or in your manual "convex" template add claims JSON: { "aud": "convex" }
const audience = process.env.CLERK_JWT_AUDIENCE || "convex";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "",
      applicationID: audience,
    },
  ],
} satisfies AuthConfig;
