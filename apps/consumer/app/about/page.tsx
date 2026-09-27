"use client";

import { useRouter } from "next/navigation";

import { businessUrl } from "@seatmate/shared/site-urls";

import {
  ArrowRightIcon,
  SiteFooter,
  SiteHeader,
} from "@/components/site-chrome";

type Step = {
  time: string;
  text: string;
  state: "neutral" | "bad" | "good";
};

const WITHOUT_SEATMATE: Step[] = [
  { time: "6:40 pm", text: "Decide on the café around the corner.", state: "neutral" },
  { time: "6:52 pm", text: "Arrive. Every table is taken.", state: "bad" },
  { time: "6:55 pm", text: "Walk to the next place you can think of.", state: "neutral" },
  { time: "7:05 pm", text: "Also full. Start searching again.", state: "bad" },
];

const WITH_SEATMATE: Step[] = [
  { time: "6:40 pm", text: "Open SeatMate and search the café around the corner.", state: "neutral" },
  { time: "6:41 pm", text: "Its floor plan shows open seats by the window.", state: "good" },
  { time: "6:52 pm", text: "Walk in and sit down.", state: "good" },
];

const PRINCIPLES = [
  {
    word: "Live",
    description:
      "Availability updates as businesses manage their floor.",
  },
  {
    word: "Simple",
    description:
      "Businesses can update occupancy with only a few taps.",
  },
  {
    word: "Local",
    description:
      "SeatMate is designed to launch community by community.",
  },
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <SiteHeader current="about" />

      {/* OPENING */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 md:pt-24 lg:pb-24">
        <p className="text-sm font-medium text-moss">About SeatMate</p>

        <h1 className="font-display mt-6 max-w-5xl text-balance text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-[5.25rem]">
          We&apos;re building for the moment you walk in and
          there&apos;s <em className="italic text-moss">nowhere to sit.</em>
        </h1>

        <div className="mt-14 grid gap-6 border-t border-line pt-8 md:grid-cols-[1fr_2fr] md:gap-16">
          <p className="font-display text-2xl italic text-gray-500">
            Know before you go.
          </p>

          <div className="max-w-2xl space-y-5 text-lg">
            <p className="text-gray-800">
              SeatMate helps people see live seating availability at
              restaurants and cafés before they arrive.
            </p>

            <p className="text-gray-600">
              Finding a restaurant or café is easy. Knowing whether there
              is actually somewhere to sit when you arrive is not.
            </p>
          </div>
        </div>
      </section>

      {/* TWO EVENINGS */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl leading-[1.05] sm:text-5xl">
              Same evening. Two ways it can go.
            </h2>

            <p className="mt-4 text-lg text-gray-600">
              You want a coffee and a table for an hour. Here&apos;s how
              that plays out without live seating, and with it.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Timeline
              variant="without"
              title="Without SeatMate"
              duration="25+ min"
              steps={WITHOUT_SEATMATE}
              ending="Twenty-five minutes in, still standing."
            />

            <Timeline
              variant="with"
              title="With SeatMate"
              duration="12 min"
              steps={WITH_SEATMATE}
              ending="One trip. One open seat."
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-moss">How it works</p>

          <h2 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
            One floor plan. Two sides of the experience.
          </h2>

          <p className="mt-5 text-lg text-gray-600">
            SeatMate connects businesses and customers through live
            floor-plan data, giving customers a clearer picture of seating
            availability while helping businesses manage occupancy with a
            simple interface.
          </p>
        </div>

        <SyncDiagram />
      </section>

      {/* PRINCIPLES */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <h2 className="font-display text-4xl leading-[1.05] sm:text-5xl">
              Less guessing.
              <br />
              <span className="text-white/45">Better decisions.</span>
            </h2>

            <p className="text-lg text-white/65">
              SeatMate is built around a simple idea: live information
              should make everyday decisions easier. Whether you are
              looking for a place to study, grab coffee, eat with friends,
              or simply find an open seat, SeatMate gives you more
              information before you leave.
            </p>
          </div>

          <dl className="mt-16 divide-y divide-white/10 border-y border-white/10">
            {PRINCIPLES.map((principle) => (
              <div
                key={principle.word}
                className="grid gap-2 py-8 sm:grid-cols-[1fr_1.3fr] sm:items-center lg:gap-16"
              >
                <dt className="font-display text-5xl sm:text-6xl lg:text-7xl">
                  {principle.word}
                  <span className="text-green-400">.</span>
                </dt>

                <dd className="max-w-md text-lg text-white/65">
                  {principle.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* STORY */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 lg:py-28">
        <p className="text-sm font-medium text-moss">Our story</p>

        <blockquote className="font-display mt-6 text-balance text-3xl leading-[1.15] sm:text-5xl">
          &ldquo;Why can we see almost everything about a restaurant online
          except whether there is actually somewhere to sit?&rdquo;
        </blockquote>

        <p className="mx-auto mt-8 max-w-xl text-lg text-gray-600">
          That question is where SeatMate started. We&apos;re building it
          to close the gap by connecting real-time information from
          businesses directly to the people deciding where to go.
        </p>
      </section>

      {/* TWO PATHS */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="grid gap-4 md:grid-cols-2">
          <PathCard
            eyebrow="Looking for a seat"
            title="See what's open near you."
            cta="Find a seat"
            onClick={() => router.push("/search")}
          />

          <PathCard
            dark
            eyebrow="Run a café or restaurant"
            title="Put your floor plan on SeatMate."
            cta="SeatMate for Business"
            onClick={() =>
              window.location.assign(businessUrl("/business/login"))
            }
          />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Timeline({
  variant,
  title,
  duration,
  steps,
  ending,
}: {
  variant: "without" | "with";
  title: string;
  duration: string;
  steps: Step[];
  ending: string;
}) {
  const good = variant === "with";

  const dotClass = (state: Step["state"]) =>
    state === "bad"
      ? "bg-seat-taken"
      : state === "good"
        ? "bg-seat-open"
        : "bg-gray-300";

  return (
    <div
      className={`flex flex-col rounded-3xl border p-6 sm:p-8 ${
        good
          ? "border-moss/25 bg-[#f2f8f3]"
          : "border-line bg-paper"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">{title}</h3>

        <span
          className={`rounded-full bg-white px-2.5 py-1 font-mono text-xs ${
            good ? "text-moss" : "text-gray-500"
          }`}
        >
          {duration}
        </span>
      </div>

      <ol className="relative mt-8 space-y-6">
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-[5px] top-2 w-px bg-gray-300"
        />

        {steps.map((step) => (
          <li key={step.time} className="relative flex gap-5">
            <span
              className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ${
                good ? "ring-[#f2f8f3]" : "ring-paper"
              } ${dotClass(step.state)}`}
            />

            <div>
              <p className="font-mono text-xs text-gray-400">
                {step.time}
              </p>

              <p className="mt-1 text-gray-800">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-8">
        <p className="font-display border-t border-dashed border-gray-300 pt-5 text-2xl">
          {ending}
        </p>
      </div>
    </div>
  );
}

// Staff tap a seat on one side; the same floor plan updates on the other.
function SyncDiagram() {
  const seats = [true, true, false, true];

  return (
    <div className="mt-12 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-4">
      <div className="rounded-3xl bg-ink p-6 text-white sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
          Behind the counter
        </p>

        <MiniTable seats={seats} ringClass="ring-ink" />

        <p className="mt-6 text-sm font-semibold">For businesses</p>

        <p className="mt-1.5 text-white/65">
          Businesses create a digital floor plan and update seat
          occupancy as customers arrive and leave.
        </p>
      </div>

      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-moss md:flex-col md:py-0"
      >
        <span className="h-6 w-px border-l border-dashed border-moss/50 md:h-16" />
        <span className="rounded-full border border-moss/30 bg-white px-3 py-1">
          updates instantly
        </span>
        <span className="h-6 w-px border-l border-dashed border-moss/50 md:h-16" />
      </div>

      <div className="rounded-3xl border border-line bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">
            On your phone
          </p>

          <p className="text-xs text-gray-500">
            <span className="font-semibold text-moss">
              {seats.filter(Boolean).length}
            </span>{" "}
            of {seats.length} open
          </p>
        </div>

        <MiniTable seats={seats} ringClass="ring-white" />

        <p className="mt-6 text-sm font-semibold">For customers</p>

        <p className="mt-1.5 text-gray-600">
          Customers see the same floor plan and live seating information
          before deciding where to go.
        </p>
      </div>
    </div>
  );
}

function MiniTable({
  seats,
  ringClass,
}: {
  seats: boolean[];
  ringClass: string;
}) {
  const seat = (open: boolean, index: number) => (
    <span
      key={index}
      className={`h-6 w-6 rounded-full ring-4 ${ringClass} ${
        open ? "bg-seat-open" : "bg-seat-taken"
      }`}
    />
  );

  return (
    <div aria-hidden="true" className="mt-8 flex flex-col items-center gap-2">
      <div className="flex gap-6">{seats.slice(0, 2).map(seat)}</div>
      <div className="h-12 w-28 rounded-xl bg-[#2a332b]" />
      <div className="flex gap-6">
        {seats.slice(2).map((open, index) => seat(open, index + 2))}
      </div>
    </div>
  );
}

function PathCard({
  eyebrow,
  title,
  cta,
  dark = false,
  onClick,
}: {
  eyebrow: string;
  title: string;
  cta: string;
  dark?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[240px] flex-col justify-between rounded-3xl p-8 text-left transition sm:p-10 ${
        dark
          ? "bg-ink text-white hover:bg-black"
          : "border border-line bg-white hover:border-gray-300"
      }`}
    >
      <div>
        <p
          className={`text-sm font-medium ${
            dark ? "text-green-400" : "text-moss"
          }`}
        >
          {eyebrow}
        </p>

        <p className="font-display mt-3 text-4xl leading-[1.05]">
          {title}
        </p>
      </div>

      <span className="mt-8 inline-flex items-center gap-2 font-semibold">
        {cta}
        <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </button>
  );
}
