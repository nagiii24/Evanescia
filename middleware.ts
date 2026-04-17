import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/search',
  '/explore',
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Browsable without auth; pages show sign-in prompts for actions that need Convex
  '/rooms(.*)',
  // SRE: the health endpoint MUST be public. Monitoring tools (Vercel uptime,
  // Pingdom, UptimeRobot, ALB target-group probes) never carry a user session.
  // Also: a health probe must not depend on the auth service being up — that
  // creates a circular dependency where Clerk going down takes your health
  // check down with it, masking the real cause during an incident.
  '/api/health',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Run for API routes EXCEPT /api/health — the health probe should have zero
    // middleware dependencies (no Clerk dev-browser handshake, no auth context
    // construction) so it stays cheap and isolated even when the rest of the
    // app is degraded. This is the Google SRE "cell isolation" principle
    // applied to a single endpoint.
    '/((?!api/health)(?:api|trpc))(.*)',
  ],
};
