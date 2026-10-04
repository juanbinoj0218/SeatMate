"use client";

import { HeartIcon } from "@/components/account-menu";
import { type PlaceSummary, useAccount } from "@/components/account-provider";

// Heart toggle for saving a place. Signed-out visitors are sent to sign in
// and brought back to the same page.
export default function SaveButton({
  place,
  variant = "icon",
  className = "",
}: {
  place: PlaceSummary;
  variant?: "icon" | "pill";
  className?: string;
}) {
  const { isFavorite, toggleFavorite } = useAccount();
  const saved = isFavorite(place.slug);

  const label = saved ? `Remove ${place.name} from saved places` : `Save ${place.name}`;

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => toggleFavorite(place)}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
          saved
            ? "bg-white text-ink"
            : "bg-white text-ink hover:bg-gray-100"
        } ${className}`}
      >
        <HeartIcon
          filled={saved}
          className={`h-4 w-4 ${saved ? "text-seat-taken" : ""}`}
        />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggleFavorite(place)}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Saved" : "Save"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition hover:bg-gray-100 ${className}`}
    >
      <HeartIcon
        filled={saved}
        className={`h-[18px] w-[18px] ${saved ? "text-seat-taken" : "text-ink"}`}
      />
    </button>
  );
}
