// The SeatMate mark (seated figure). Filled with currentColor, so set the
// color with a text-* class on the element or a parent.

import { SEATMATE_MARK_PATH, SEATMATE_MARK_VIEWBOX } from "../seatmate-mark";

export { SEATMATE_MARK_PATH, SEATMATE_MARK_VIEWBOX };

export default function SeatMateMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={SEATMATE_MARK_VIEWBOX}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d={SEATMATE_MARK_PATH} />
    </svg>
  );
}
