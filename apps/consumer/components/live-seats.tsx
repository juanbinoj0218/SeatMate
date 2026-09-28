"use client";

import { useEffect, useState } from "react";

import { fetchSeatSummary, type SeatSummary } from "@/lib/places";

// Live "X of Y seats open" for server-rendered lists such as city pages.
export default function LiveSeats({ businessId }: { businessId: string }) {
  const [seats, setSeats] = useState<SeatSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSeatSummary(businessId).then((summary) => {
      if (!cancelled) setSeats(summary);
    });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!seats) {
    return <span className="text-sm text-gray-400">Checking seats…</span>;
  }

  if (seats.totalSeats === 0) {
    return <span className="text-sm text-gray-400">No seating data yet</span>;
  }

  const open = seats.availableSeats > 0;

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${open ? "bg-seat-open" : "bg-seat-taken"}`} />
      <span className={`font-semibold ${open ? "text-moss" : "text-seat-taken"}`}>
        {seats.availableSeats}
      </span>
      <span className="text-gray-500">of {seats.totalSeats} seats open</span>
    </span>
  );
}
