import { ImageResponse } from "next/og";

import {
  SEATMATE_MARK_PATH,
  SEATMATE_MARK_VIEWBOX,
} from "@seatmate/shared/components/SeatMateMark";

// The card shown when someone shares the waitlist link (iMessage,
// Instagram, WhatsApp, X).

export const alt = "SeatMate: know if there's a seat before you go. Join the waitlist.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#101811";
const OPEN = "#22a55b";

// The waitlist's table with every chair open.
const SEATS = [
  { left: 104, top: 0 },
  { left: 208, top: 76 },
  { left: 104, top: 152 },
  { left: 0, top: 76 },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: INK,
          color: "white",
          padding: "64px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="56" height="56" viewBox={SEATMATE_MARK_VIEWBOX} fill="white">
              <path d={SEATMATE_MARK_PATH} />
            </svg>
            <span style={{ fontSize: 36, fontWeight: 700 }}>SeatMate</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.03em", maxWidth: 700 }}>
              Know if there&rsquo;s a seat before you go.
            </span>
            <span style={{ fontSize: 30, color: "rgba(255,255,255,0.65)", marginTop: 24 }}>
              Join the waitlist for your neighborhood.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", position: "relative", width: 264, height: 208 }}>
          <div
            style={{
              position: "absolute",
              left: 56,
              top: 56,
              width: 152,
              height: 96,
              borderRadius: 22,
              border: "4px solid rgba(255,255,255,0.35)",
            }}
          />
          {SEATS.map((seat, index) => (
            <div
              key={index}
              style={{
                position: "absolute",
                left: seat.left,
                top: seat.top,
                width: 56,
                height: 56,
                borderRadius: 999,
                background: OPEN,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size
  );
}
