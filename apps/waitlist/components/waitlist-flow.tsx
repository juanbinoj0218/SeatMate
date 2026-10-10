"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  Beer,
  Check,
  ChevronLeft,
  Coffee,
  Link2,
  LoaderCircle,
  Scissors,
  Share2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { consumerUrl } from "@seatmate/shared/site-urls";

import SeatTable from "@/components/seat-table";
import { appCheckHeaders, startAppCheck } from "@/lib/app-check";
import { WAITLIST_SITE_URL } from "@/lib/site";
import { EMAIL_PATTERN, normalizePhone, type Feeling, type VenueType } from "@/lib/waitlist";

// Types must match VENUE_TYPES in lib/waitlist.ts. Each place asks its own
// question about the problem SeatMate fixes there.
const VENUES: {
  type: VenueType;
  label: string;
  icon: LucideIcon;
  question: string;
  example: string;
}[] = [
  {
    type: "cafe",
    label: "Café",
    icon: Coffee,
    question: "Ever wish you knew which tables were free before you took your laptop to a café?",
    example: "e.g. Blue Door Café",
  },
  {
    type: "restaurant",
    label: "Restaurant",
    icon: UtensilsCrossed,
    question: "Ever wish you could see where you'd sit at a restaurant before you walked in?",
    example: "e.g. Luigi's Trattoria",
  },
  {
    type: "bar",
    label: "Bar",
    icon: Beer,
    question: "Ever wish you knew how busy a bar was before you went, packed or dead?",
    example: "e.g. The Corner Tap",
  },
  {
    type: "barbershop",
    label: "Barbershop",
    icon: Scissors,
    question: "Ever wish you could see a barber was free and just walk in, no appointment?",
    example: "e.g. Fresh Cuts on J St",
  },
];

const ANSWERS: { value: Feeling; label: string }[] = [
  { value: "often", label: "All the time" },
  { value: "sometimes", label: "Sometimes" },
  { value: "rarely", label: "Not really" },
];

const STEPS = 4;

export default function WaitlistFlow() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const [venues, setVenues] = useState<VenueType[]>([]);
  const [feelings, setFeelings] = useState<Partial<Record<VenueType, Feeling>>>({});
  const [spotName, setSpotName] = useState("");
  const [spotArea, setSpotArea] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  // Hidden from people; only bots fill it in.
  const [company, setCompany] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alreadyIn, setAlreadyIn] = useState(false);

  // Start the invisible bot check early so it's ready by the last step.
  useEffect(() => startAppCheck(), []);

  const go = (next: number) => {
    setDirection(next > step ? "forward" : "back");
    setError("");
    setStep(next);
  };

  const chosen = VENUES.filter((option) => venues.includes(option.type));
  const allAnswered = chosen.every((option) => feelings[option.type]);

  const toggleVenue = (type: VenueType) =>
    setVenues((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Add your name.");
      return;
    }
    if (!EMAIL_PATTERN.test(cleanEmail) || cleanEmail.length > 200) {
      setError("That email doesn't look right.");
      return;
    }

    if (phone.trim() && !normalizePhone(phone)) {
      setError("That phone number doesn't look right.");
      return;
    }
    if (phone.trim() && !smsConsent) {
      setError("Tick the box to get texts, or leave the number blank.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          venueTypes: venues,
          feelings: Object.fromEntries(chosen.map((option) => [option.type, feelings[option.type]])),
          spotName,
          spotArea,
          phone: phone.trim(),
          smsConsent,
          company,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.joined) {
        setError(result.error || "We couldn't save that. Check your connection and try again.");
        return;
      }

      setAlreadyIn(Boolean(result.already));
      go(STEPS);
    } catch (caught) {
      console.error("Could not join the waitlist:", caught);
      setError("We couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const firstName = name.trim().split(/\s+/)[0];

  return (
    <div className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
        <SeatTable open={Math.min(step, STEPS)} />
        {step > 0 && step < STEPS && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-black/[0.04] hover:text-ink"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      <div key={step} className={`pt-6 ${direction === "forward" ? "step-forward" : "step-back"}`}>
        {step === 0 && (
          <div className="mb-6 rounded-2xl bg-paper px-4 py-3.5">
            <p className="font-semibold">Join the SeatMate waitlist</p>
            <p className="mt-0.5 text-sm text-gray-600">
              Four quick questions and you&rsquo;re on the list. We&rsquo;ll invite you when SeatMate opens near you.
            </p>
          </div>
        )}

        {step === 0 && (
          <Step title="Where would SeatMate help you?" hint="Pick as many as you like.">
            <div className="grid grid-cols-2 gap-3">
              {VENUES.map((option) => {
                const Icon = option.icon;
                const selected = venues.includes(option.type);
                return (
                  <button
                    key={option.type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleVenue(option.type)}
                    className={`relative flex flex-col items-start gap-6 rounded-2xl border p-4 text-left font-semibold transition active:scale-[0.97] ${
                      selected
                        ? "border-ink bg-ink text-white"
                        : "border-line hover:border-gray-400"
                    }`}
                  >
                    <Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
                    {option.label}
                    <span
                      aria-hidden
                      className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border ${
                        selected ? "border-white bg-white text-ink" : "border-line"
                      }`}
                    >
                      {selected && <Check className="h-4 w-4" strokeWidth={2.5} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <NextButton onClick={() => go(1)} disabled={venues.length === 0} />
          </Step>
        )}

        {step === 1 && (
          <Step title={chosen.length === 1 ? "One quick question" : "A quick question for each"}>
            <div className="space-y-6">
              {chosen.map((option) => {
                const Icon = option.icon;
                return (
                  <fieldset key={option.type}>
                    <legend className="flex gap-3 font-semibold leading-snug">
                      <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
                      {option.question}
                    </legend>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {ANSWERS.map((answer) => {
                        const selected = feelings[option.type] === answer.value;
                        return (
                          <button
                            key={answer.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setFeelings((current) => ({ ...current, [option.type]: answer.value }))}
                            className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition active:scale-[0.97] ${
                              selected ? "border-ink bg-ink text-white" : "border-line hover:border-gray-400"
                            }`}
                          >
                            {answer.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <NextButton onClick={() => go(2)} disabled={!allAnswered} />
          </Step>
        )}

        {step === 2 && (
          <Step
            title="Which spot should we add first?"
            hint="We ask the places people name most. Leave it blank if nothing comes to mind."
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                go(3);
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={spotName}
                onChange={(event) => setSpotName(event.target.value)}
                maxLength={120}
                placeholder={chosen[0]?.example ?? "Place name"}
                aria-label="Place name"
                className="w-full"
                autoFocus
              />
              <input
                type="text"
                value={spotArea}
                onChange={(event) => setSpotArea(event.target.value)}
                maxLength={160}
                placeholder="Neighborhood or city"
                aria-label="Neighborhood or city"
                className="w-full"
              />
              <NextButton label={spotName.trim() ? "Continue" : "Skip for now"} />
            </form>
          </Step>
        )}

        {step === 3 && (
          <Step title="Where should we send your invite?">
            <form onSubmit={submit} className="space-y-3" noValidate>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="Your name"
                aria-label="Your name"
                autoComplete="name"
                className="w-full"
                autoFocus
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={200}
                placeholder="you@email.com"
                aria-label="Email"
                autoComplete="email"
                inputMode="email"
                className="w-full"
              />
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={30}
                  placeholder="Phone number"
                  aria-label="Phone number, optional"
                  aria-describedby={phone.trim() ? undefined : "phone-note"}
                  autoComplete="tel"
                  inputMode="tel"
                  className="w-full !pr-24"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-paper px-2 py-1 text-xs font-semibold text-gray-500"
                >
                  Optional
                </span>
              </div>
              {!phone.trim() && (
                <p id="phone-note" className="-mt-1 px-1 text-sm text-gray-500">
                  Skip it if you&rsquo;d rather hear from us by email only.
                </p>
              )}
              {phone.trim() && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-paper px-3.5 py-3 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(event) => {
                      setSmsConsent(event.target.checked);
                      setError("");
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#101811]"
                  />
                  <span>
                    Text me when SeatMate opens near me. Up to a few texts about the launch, msg and data
                    rates may apply. Reply STOP to opt out.
                  </span>
                </label>
              )}
              <input
                type="text"
                name="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />
              {error && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 font-semibold text-white transition hover:bg-black active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle aria-hidden className="h-5 w-5 animate-spin" />
                ) : (
                  "Join the waitlist"
                )}
              </button>
              <p className="pt-1 text-center text-sm text-gray-500">
                We only contact you about SeatMate opening near you. See our{" "}
                <a
                  href={consumerUrl("/privacy")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline underline-offset-2"
                >
                  privacy policy
                </a>
                .
              </p>
            </form>
          </Step>
        )}

        {step === STEPS && (
          <Done
            alreadyIn={alreadyIn}
            firstName={firstName}
            email={email.trim().toLowerCase()}
            texting={Boolean(phone.trim())}
            spotName={spotName.trim()}
          />
        )}
      </div>

    </div>
  );
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl leading-tight">{title}</h2>
      {hint && <p className="mt-2 text-gray-600">{hint}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function NextButton({
  label = "Continue",
  onClick,
  disabled = false,
}: {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 font-semibold text-white transition hover:bg-black active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
    >
      {label}
      <ArrowRight aria-hidden className="h-4 w-4" />
    </button>
  );
}

function Done({
  alreadyIn,
  firstName,
  email,
  texting,
  spotName,
}: {
  alreadyIn: boolean;
  firstName: string;
  email: string;
  texting: boolean;
  spotName: string;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const data = {
      title: "SeatMate",
      text: "See open seats and wait times before you go. Join the SeatMate waitlist:",
      url: WAITLIST_SITE_URL,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(WAITLIST_SITE_URL);
      setCopied(true);
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  };

  return (
    <div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-seat-open text-white">
        <Check aria-hidden className="h-6 w-6" strokeWidth={2.5} />
      </span>
      <h2 className="mt-5 text-2xl leading-tight">
        {alreadyIn ? "You're already on the list." : `You're on the list, ${firstName}.`}
      </h2>
      <p className="mt-2 text-gray-600">
        We&rsquo;ll email <span className="font-semibold text-ink">{email}</span>
        {texting && !alreadyIn && " and text you"} when SeatMate opens near you.
        {spotName && !alreadyIn && ` We'll also let ${spotName} know people want live seats there.`}
      </p>

      <button
        type="button"
        onClick={share}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-full border border-line px-5 py-3.5 font-semibold transition hover:border-gray-400 active:scale-[0.98]"
      >
        {copied ? (
          <>
            <Link2 aria-hidden className="h-4 w-4" />
            Link copied
          </>
        ) : (
          <>
            <Share2 aria-hidden className="h-4 w-4" />
            Send it to a friend
          </>
        )}
      </button>
    </div>
  );
}
