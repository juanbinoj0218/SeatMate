import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Body and interface text (same as the consumer site).
const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ["latin"],
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
      className={`${schibstedGrotesk.variable} h-full antialiased`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
