import type { Metadata } from "next";
import Link from "next/link";

import ProsePage from "@/components/prose-page";
import { CONTACT_EMAIL } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Privacy Policy – SeatMate",
  description: "What SeatMate collects, why, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy" updated="October 1, 2026">
      <p>
        SeatMate shows live seating at cafés, restaurants, bars and barbershops. This policy explains what we
        collect when you use seatmate360.com, the SeatMate business portal (seatmate360.net) and the
        SeatMate app, and what we do with it. The short version: we collect only what the product
        needs, we don&apos;t sell your data, and we don&apos;t show ads.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> if you create an account: your name, email address and,
            if you sign in with Google, your Google profile photo.
          </li>
          <li>
            <strong>Things you save</strong>: saved places and the last few places
            you viewed, so your account can show them back to you.
          </li>
          <li>
            <strong>Seat alerts</strong>: when you ask to be emailed about an open seat, we store your
            email and the place. The alert turns off after it&apos;s sent or after 12 hours.
          </li>
          <li>
            <strong>Messages you send us</strong> through the contact or &ldquo;suggest a place&rdquo;
            forms, including any email you include.
          </li>
          <li>
            <strong>Anonymous counts</strong>: each place&apos;s daily number of page views, saves and QR
            code scans. These totals aren&apos;t linked to you.
          </li>
          <li>
            <strong>Business accounts</strong>: business name, address, hours, floor plan, seat
            updates, and staff names and emails.
          </li>
        </ul>
      </section>

      <section>
        <h2>Services we rely on</h2>
        <ul>
          <li>Google Firebase for sign-in and our database.</li>
          <li>Vercel to host the websites.</li>
          <li>Google Maps Platform to show public Google reviews on place pages.</li>
          <li>Resend to send seat alert emails.</li>
        </ul>
        <p>They process data only to provide their service to us.</p>
      </section>

      <section>
        <h2>Cookies and storage</h2>
        <p>
          We use your browser&apos;s storage to keep you signed in and to avoid counting the same page
          view twice in one visit. We don&apos;t use advertising or cross-site tracking cookies.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Edit your name, remove saved places or clear your history from your account page.</li>
          <li>Cancel a seat alert from the place page.</li>
          <li>
            Delete your account and its data any time from your account page (&ldquo;Delete
            account&rdquo;). Or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the
            address on your account, which also covers messages you sent us.
          </li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>SeatMate isn&apos;t directed at children under 13, and we don&apos;t knowingly collect their data.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If this policy changes, we&apos;ll update the date above. Questions? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use our{" "}
          <Link href="/contact">contact form</Link>.
        </p>
      </section>
    </ProsePage>
  );
}
