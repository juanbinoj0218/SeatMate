import { ImageResponse } from "next/og";

import {
  SEATMATE_MARK_PATH,
  SEATMATE_MARK_VIEWBOX,
} from "@seatmate/shared/components/SeatMateMark";

// Link-preview image (Open Graph) shared by the site and place pages.
export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#101811";
const OPEN = "#22a55b";
const TAKEN = "#e5534b";

// A row of seats, some open and some taken, as a nod to the product.
const SEATS = [true, false, true, true, false, true, false, false, true, true];

export function ogCard({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          color: "white",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox={SEATMATE_MARK_VIEWBOX} fill="white">
            <path d={SEATMATE_MARK_PATH} />
          </svg>
          <span style={{ fontSize: 36, fontWeight: 700 }}>SeatMate</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 28, color: "#4ade80", fontWeight: 600 }}>{eyebrow}</span>
          <span
            style={{
              fontSize: title.length > 28 ? 72 : 88,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              marginTop: 14,
              maxWidth: 1000,
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 30, color: "rgba(255,255,255,0.6)", marginTop: 22, maxWidth: 980 }}>
            {subtitle}
          </span>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {SEATS.map((open, index) => (
            <div
              key={index}
              style={{ width: 34, height: 34, borderRadius: 999, background: open ? OPEN : TAKEN }}
            />
          ))}
        </div>
      </div>
    ),
    OG_SIZE
  );
}
