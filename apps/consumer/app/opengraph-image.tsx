import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt = "SeatMate – see open seats before you go";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Live seating availability",
    title: "See open seats before you go.",
    subtitle: "Cafés, restaurants and bars, updated live by the people who work there.",
  });
}
