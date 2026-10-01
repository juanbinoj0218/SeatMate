import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  // next/font has no metrics for this family, so skip the adjusted fallback.
  adjustFontFallback: false,
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "SeatMate Admin",
  description: "SeatMate administration.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
