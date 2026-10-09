// A small table with four chairs. Each finished step of the waitlist opens
// one chair, so the table doubles as the progress bar.

const SEATS = [
  { cx: 100, cy: 22 },
  { cx: 178, cy: 70 },
  { cx: 100, cy: 118 },
  { cx: 22, cy: 70 },
];

export default function SeatTable({ open }: { open: number }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <svg
        viewBox="0 0 200 140"
        className="h-[56px] w-[80px] shrink-0 sm:h-[70px] sm:w-[100px]"
        role="img"
        aria-label={`${open} of ${SEATS.length} seats open`}
      >
        <rect x="46" y="44" width="108" height="52" rx="14" fill="#ffffff" stroke="#d6dcd5" strokeWidth="2" />
        {SEATS.map((seat, index) => {
          const isOpen = index < open;
          return (
            <circle
              // Re-mount on change so a newly opened chair pops.
              key={`${index}-${isOpen}`}
              cx={seat.cx}
              cy={seat.cy}
              r="16"
              fill={isOpen ? "var(--color-seat-open)" : "var(--color-seat-taken)"}
              className={isOpen ? "seat-pop" : undefined}
              style={{ transition: "fill 250ms ease" }}
            />
          );
        })}
      </svg>
      <p className="whitespace-nowrap text-sm text-gray-500">
        <span className="font-semibold text-ink">{open} of {SEATS.length}</span> <span className="hidden sm:inline">seats </span>open
      </p>
    </div>
  );
}
