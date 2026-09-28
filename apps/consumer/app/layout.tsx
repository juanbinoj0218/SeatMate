import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Geist_Mono,
  Schibsted_Grotesk,
} from "next/font/google";
import "./globals.css";

import { CONSUMER_SITE_URL } from "@seatmate/shared/site-urls";

import { AccountProvider } from "@/components/account-provider";

// Body and interface text.
const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

// Page headlines (used via the font-display class). The optical-size and
// width axes let large headlines tighten up without looking squashed.
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Check live seating availability at cafés, restaurants and bars before you arrive.";

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
      className={`${schibstedGrotesk.variable} ${bricolageGrotesque.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="antialiased">
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
