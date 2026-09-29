// A table drawn from above with its seats sitting on the table itself:
// in a ring on round tables and in rows along the long sides of
// rectangular ones. Used by the floor-plan editor, the staff screen, the
// customer place page and the admin review.

export type TableShape = "round" | "rectangle";

export type TableSeat = {
  id: number;
  status: "available" | "occupied";
};

// Base size (px, before the table's own scale) for a table with `count`
// seats, grown so the seats never get cramped.
export function tableSize(shape: TableShape, count: number, scale = 1) {
  if (shape === "round") {
    const diameter = count <= 6 ? 130 : 130 + (count - 6) * 10;
    return { width: diameter * scale, height: diameter * scale };
  }

  const columns = Math.max(1, Math.ceil(count / 2));
  return { width: Math.max(150, columns * 40 + 44) * scale, height: 112 * scale };
}

type SeatSpot = { left: number; top: number };

// Where each seat goes, as % of the table box, plus where the name sits.
function layout(shape: TableShape, count: number, width: number, height: number) {
  const spots: SeatSpot[] = [];
  let seatSize: number;
  let nameTop = 50;

  if (shape === "round") {
    const diameter = Math.min(width, height);

    if (count === 1) {
      spots.push({ left: 50, top: 70 });
      nameTop = 38;
      seatSize = diameter * 0.24;
    } else {
      const radius = 37;
      // Four seats go on the diagonals so the name has room in the middle.
      const offset = count === 4 ? Math.PI / 4 : 0;
      for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + offset + (index / count) * Math.PI * 2;
        spots.push({ left: 50 + Math.cos(angle) * radius, top: 50 + Math.sin(angle) * radius });
      }
      const spacing = (2 * Math.PI * diameter * (radius / 100)) / count;
      seatSize = Math.min(diameter * 0.22, spacing * 0.78);
    }
  } else if (count <= 2) {
    // One row along the bottom, name above it.
    for (let index = 0; index < count; index += 1) {
      spots.push({ left: count === 1 ? 50 : 32 + index * 36, top: 66 });
    }
    nameTop = 30;
    seatSize = Math.min(height * 0.34, width * 0.28);
  } else {
    // Two rows along the long sides, name in the middle.
    const top = Math.ceil(count / 2);
    const bottom = count - top;
    const inset = 12;
    const place = (n: number, row: number) => {
      for (let index = 0; index < n; index += 1) {
        spots.push({ left: n === 1 ? 50 : inset + (index * (100 - inset * 2)) / (n - 1), top: row });
      }
    };
    place(top, 24);
    place(bottom, 76);
    const spacing = (width * (1 - (inset * 2) / 100)) / Math.max(1, top - 1 || 1);
    seatSize = Math.min(height * 0.3, spacing * 0.8);
  }

  return { spots, seatSize: Math.max(14, Math.min(seatSize, 40)), nameTop };
}

export default function TableWithSeats({
  name,
  shape,
  seats,
  width,
  height,
  onSeatClick,
  seatsDisabled = false,
  showName = true,
  className = "",
}: {
  name: string;
  shape: TableShape;
  seats: TableSeat[];
  width: number;
  height: number;
  onSeatClick?: (seatId: number) => void;
  seatsDisabled?: boolean;
  showName?: boolean;
  className?: string;
}) {
  const { spots, seatSize, nameTop } = layout(shape, seats.length, width, height);
  const open = seats.filter((seat) => seat.status === "available").length;
  const fontSize = Math.max(9, Math.min(13, Math.min(width, height) * 0.11));

  return (
    <div
      className={`relative bg-[#101811] text-white shadow-md ${shape === "round" ? "rounded-full" : "rounded-2xl"} ${className}`}
      style={{ width, height }}
      aria-label={`${name}: ${open} of ${seats.length} seats open`}
    >
      {showName && (
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 truncate text-center font-bold leading-tight"
          style={{ top: `${nameTop}%`, fontSize, maxWidth: shape === "round" && seats.length > 4 ? "50%" : "70%" }}
        >
          {name}
        </span>
      )}

      {seats.map((seat, index) => {
        const spot = spots[index];
        const classes = `absolute flex items-center justify-center rounded-full border-2 border-[#101811] font-bold text-white shadow-sm ${
          seat.status === "available" ? "bg-green-500" : "bg-red-500"
        }`;
        const style = {
          left: `${spot.left}%`,
          top: `${spot.top}%`,
          width: seatSize,
          height: seatSize,
          transform: "translate(-50%, -50%)",
          fontSize: Math.max(8, seatSize * 0.38),
        };
        const label = `Seat ${seat.id}: ${seat.status === "available" ? "open" : "taken"}`;

        return onSeatClick ? (
          <button
            key={seat.id}
            type="button"
            disabled={seatsDisabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSeatClick(seat.id);
            }}
            title={label}
            aria-label={label}
            className={`${classes} ${seatsDisabled ? "cursor-default" : "transition-transform hover:scale-110 active:scale-95"}`}
            style={style}
          >
            {seat.id}
          </button>
        ) : (
          <span key={seat.id} title={label} className={classes} style={style}>
            {seat.id}
          </span>
        );
      })}
    </div>
  );
}
