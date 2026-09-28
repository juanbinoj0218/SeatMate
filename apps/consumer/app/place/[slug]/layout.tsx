import type { Metadata } from "next";

import { getPlaceServer } from "@/lib/places-server";

// The place page itself is a live client page; this server layout gives it
// a real title and link preview for search engines and shared links.
export async function generateMetadata({ params }: LayoutProps<"/place/[slug]">): Promise<Metadata> {
  const place = await getPlaceServer((await params).slug);

  if (!place) {
    return { title: "Place not found – SeatMate" };
  }

  const title = `${place.name} – live seats on SeatMate`;
  const description = `See open seats at ${place.name}${place.address ? `, ${place.address}` : ""} right now, before you go.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "SeatMate" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function PlaceLayout({ children }: LayoutProps<"/place/[slug]">) {
  return children;
}
