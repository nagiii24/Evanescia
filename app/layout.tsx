import type { Metadata } from "next";
import "./globals.css";
import dynamic from "next/dynamic";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/lib/convex-provider";
import LofiBackground from "@/components/ui/LofiBackground";
import NavBar from "@/components/navigation/NavBar";
import HeaderAuth from "@/components/layout/HeaderAuth";
import LikedSongsSync from "@/components/layout/LikedSongsSync";
import SakuraDrop from "@/components/ui/SakuraDrop";
import ErrorLogger from "@/components/ErrorLogger";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SystemHealthProvider } from "@/components/system-health/SystemHealthProvider";
import { LowBandwidthBanner } from "@/components/system-health/LowBandwidthBanner";
import { ShedableArea } from "@/components/system-health/ShedableArea";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

/** Avoid SSR for the YouTube player stack (react-player); prevents prod/hydration edge cases on Vercel. */
const PlayerBar = dynamic(() => import("@/components/player/PlayerBar"), { ssr: false });

export const metadata: Metadata = {
  title: "Evanescia",
  description: "Music app built with Next.js",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  if (!clerkPk) {
    return (
      <html lang="en">
        <body style={{ fontFamily: "system-ui", padding: 24, maxWidth: 560 }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Missing environment variable</h1>
          <p style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> in your Vercel project (Settings → Environment Variables),
            then redeploy. Add <code>NEXT_PUBLIC_CONVEX_URL</code> as well if you use Convex.
          </p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={playfair.variable}>
      <body className={playfair.variable}>
        <ClerkProvider
          publishableKey={clerkPk}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <ConvexClientProvider>
            {/* SystemHealthProvider sits ABOVE ErrorBoundary so load-shedding
                decisions keep working even if a downstream tree crashes. It sits
                INSIDE ClerkProvider because auth failures are a legitimate input
                to future health signals. */}
            <SystemHealthProvider>
              {/* Banner renders only in RED — zero cost in normal operation. */}
              <LowBandwidthBanner />
              <LofiBackground />
              {/* Decorative sakura petals: animations are pure GPU load with
                  zero functional value. Shed at YELLOW (and therefore RED). */}
              <ShedableArea minStatus="GREEN">
                <SakuraDrop />
              </ShedableArea>
              <NavBar />
              <HeaderAuth />
              <ErrorBoundary>
                <LikedSongsSync />
                {children}
                {/* PlayerBar is ALWAYS mounted. It must not read load-shedding
                    flags in a way that affects audio output — music is our
                    one sacred feature. */}
                <PlayerBar />
              </ErrorBoundary>
              <ErrorLogger />
            </SystemHealthProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

