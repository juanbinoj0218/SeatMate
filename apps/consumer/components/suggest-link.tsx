"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useFeatures } from "@/lib/use-features";

// A "suggest a place" link that disappears when admins turn the feature off.
export default function SuggestLink({ href = "/suggest", before, children }: { href?: string; before?: ReactNode; children: ReactNode }) {
  const { suggestPlace } = useFeatures();

  if (!suggestPlace) {
    return null;
  }

  return (
    <>
      {before}
      <Link href={href} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
        {children}
      </Link>
    </>
  );
}
