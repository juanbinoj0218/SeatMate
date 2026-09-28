"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Shown on the home page after someone deletes their account.
export default function AccountDeletedNotice() {
  return (
    <Suspense>
      <Notice />
    </Suspense>
  );
}

function Notice() {
  const params = useSearchParams();
  const [hidden, setHidden] = useState(false);

  if (hidden || params.get("account") !== "deleted") {
    return null;
  }

  return (
    <div className="mx-auto mt-6 max-w-6xl px-5 sm:px-8">
      <div role="status" className="flex items-center justify-between gap-4 rounded-2xl bg-ink px-5 py-4 text-sm text-white">
        <span>Your account and its data have been deleted. Thanks for trying SeatMate.</span>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            window.history.replaceState(null, "", "/");
          }}
          className="shrink-0 font-semibold text-white/70 hover:text-white"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
