import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Geist_Mono,
  Schibsted_Grotesk,
} from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "SeatMate – Live seating availability",
  description:
    "Check live seating availability at cafés and restaurants before you arrive.",
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
