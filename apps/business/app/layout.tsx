import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Body and interface text (same as the consumer site).
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  // next/font has no metrics for this family, so skip the adjusted fallback.
  adjustFontFallback: false,
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "SeatMate for Business",
  description:
    "Manage your floor plan, staff, and live seating availability.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} h-full antialiased`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
