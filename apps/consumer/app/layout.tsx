import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Next,
  IBM_Plex_Mono,
  Young_Serif,
} from "next/font/google";
import "./globals.css";

import { CONSUMER_SITE_URL } from "@seatmate/shared/site-urls";

import { AccountProvider } from "@/components/account-provider";

// Body and interface text. Built for legibility, with letterforms that
// don't look like every other startup site.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  // next/font has no metrics for this family, so skip the adjusted fallback.
  adjustFontFallback: false,
  variable: "--font-body",
});

// Page headlines (used via the font-display class): a warm, chunky serif
// with a neighborhood-café feel. It comes in one weight.
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

const description =
  "Check live seating availability at cafés, restaurants, bars and barbershops before you arrive.";

export const metadata: Metadata = {
  metadataBase: new URL(CONSUMER_SITE_URL),
  title: "SeatMate – Live seating availability",
  description,
  openGraph: {
    siteName: "SeatMate",
    type: "website",
    title: "SeatMate – Live seating availability",
    description,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${youngSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="antialiased">
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
