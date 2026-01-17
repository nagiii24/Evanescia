import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/lib/convex-provider";
import PlayerBar from "@/components/player/PlayerBar";
import LofiBackground from "@/components/ui/LofiBackground";
import NavBar from "@/components/navigation/NavBar";
import HeaderAuth from "@/components/layout/HeaderAuth";
import LikedSongsSync from "@/components/layout/LikedSongsSync";
import SakuraDrop from "@/components/ui/SakuraDrop";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

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
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <html lang="en" className={playfair.variable}>
          <body className={playfair.variable}>
            <LofiBackground />
            <SakuraDrop />
            <NavBar />
            <HeaderAuth />
            <LikedSongsSync />
            {children}
            <PlayerBar />
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}

