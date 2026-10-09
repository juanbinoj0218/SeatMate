import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible_Next,
  IBM_Plex_Mono,
  Young_Serif,
} from "next/font/google";
import "./globals.css";

import { WAITLIST_SITE_URL } from "@/lib/site";

// Same type as the customer site, so the waitlist reads as SeatMate.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  // next/font has no metrics for this family, so skip the adjusted fallback.
  adjustFontFallback: false,
  variable: "--font-body",
});

const youngSerif = Young_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-headline",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

const title = "SeatMate – Join the waitlist";
const description =
  "See open seats and short waits at barbershops, bars and cafés before you leave. Join the SeatMate waitlist.";

export const metadata: Metadata = {
  metadataBase: new URL(WAITLIST_SITE_URL),
  title,
  description,
  openGraph: { siteName: "SeatMate", type: "website", title, description },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f7f8f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${youngSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
