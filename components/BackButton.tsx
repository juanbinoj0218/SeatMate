"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallback?: string;
};

export default function BackButton({
  fallback = "/",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#101811] transition"
    >
      <span className="text-lg">←</span>
      Back
    </button>
  );
}