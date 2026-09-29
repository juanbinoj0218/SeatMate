import Link from "next/link";

// Goes to a fixed parent page rather than the browser's previous page, so
// it can never bounce between pages (e.g. dashboard ⇄ login) or leave the
// site.
export default function BackButton({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#101811] transition"
    >
      <span className="text-lg" aria-hidden>
        ←
      </span>
      {label}
    </Link>
  );
}
