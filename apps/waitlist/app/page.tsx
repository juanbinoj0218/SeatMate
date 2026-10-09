import SeatMateMark from "@seatmate/shared/components/SeatMateMark";

import WaitlistFlow from "@/components/waitlist-flow";

const POINTS = [
  "Open chairs and seats, updated by the place itself.",
  "How long the wait is right now, not last week.",
  "A ping when your usual spot frees up.",
];

export default function WaitlistPage() {
  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
            <SeatMateMark className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">SeatMate</span>
        </span>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-8 px-5 pb-16 pt-4 sm:px-8 md:pt-14 lg:grid-cols-[1fr_460px] lg:gap-20">
        <div className="lg:pt-6">
          <h1 className="font-display text-[2.4rem] leading-[1.04] sm:text-6xl">
            Know if there&rsquo;s a seat before you go.
          </h1>
          <p className="mt-4 max-w-md text-gray-600 sm:mt-5 sm:text-lg">
            SeatMate shows live seats and wait times at barbershops, bars and cafés
            near you. We&rsquo;re opening it one neighborhood at a time.
          </p>

          <ul className="mt-8 hidden max-w-md space-y-3 lg:block">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-gray-700">
                <span aria-hidden className="mt-[0.6rem] h-2 w-2 shrink-0 rounded-full bg-seat-open" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <WaitlistFlow />
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-sm text-gray-500 sm:px-8">
          <span>&copy; {new Date().getFullYear()} SeatMate LLC</span>
          <span>We only email you about SeatMate opening near you.</span>
        </div>
      </footer>
    </main>
  );
}
