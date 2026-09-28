import { OG_SIZE, ogCard } from "@/lib/og-card";
import { getPlaceServer } from "@/lib/places-server";

export const alt = "Live seats on SeatMate";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const place = await getPlaceServer((await params).slug);

  return ogCard({
    eyebrow: place?.type ? `${place.type} · Live seats` : "Live seats",
    title: place?.name || "SeatMate",
    subtitle: place?.address || "See open seats before you go.",
  });
}
