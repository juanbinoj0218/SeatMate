import type { Metadata } from "next";
import Link from "next/link";

import { consumerUrl } from "@seatmate/shared/site-urls";

import { ProsePage } from "@/components/site-chrome";
import { CONTACT_EMAIL } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Terms and Conditions – SeatMate for Business",
  description: "The terms for listing and managing a business on SeatMate.",
};

export default function TermsPage() {
  return (
    <ProsePage title="Terms and Conditions" updated="October 1, 2026">
      <p>
        These terms cover businesses and their staff using the SeatMate business portal at
        seatmate360.net. By creating a business account or accepting a staff invite, you agree to
        them. Customers using seatmate360.com are covered by the{" "}
        <a href={consumerUrl("/terms")}>customer terms</a>.
      </p>

      <section>
        <h2>Who can sign up</h2>
        <ul>
          <li>You must be at least 18 and able to agree to these terms for your business.</li>
          <li>Only list a business you own or are authorized to manage.</li>
          <li>Give accurate business details: name, address, type and hours.</li>
          <li>Keep your password safe. You&apos;re responsible for activity on your account.</li>
        </ul>
      </section>

      <section>
        <h2>Your listing</h2>
        <ul>
          <li>We review each business before it appears to customers, and may decline, hide or remove a listing.</li>
          <li>
            You keep ownership of what you upload (cover photo, floor plan, hours). You let SeatMate
            show it on seatmate360.com, in the SeatMate app and in links people share.
          </li>
          <li>Don&apos;t upload photos or text you don&apos;t have the right to use.</li>
        </ul>
      </section>

      <section>
        <h2>Live seat updates</h2>
        <ul>
          <li>Keep your seat, table and game updates reasonably accurate. Customers plan trips around them.</li>
          <li>Don&apos;t post fake availability to draw people in or keep them away.</li>
          <li>
            Seat availability is a guide, not a reservation. SeatMate doesn&apos;t promise customers a
            seat, and you aren&apos;t required to hold one for them.
          </li>
        </ul>
      </section>

      <section>
        <h2>Staff</h2>
        <ul>
          <li>Only invite people who work for your business.</li>
          <li>You&apos;re responsible for what your staff post and should remove them when they leave.</li>
          <li>Staff can update seats but can&apos;t change your business details or floor plan.</li>
        </ul>
      </section>

      <section>
        <h2>Fees</h2>
        <p>
          The business portal is free during SeatMate&apos;s launch. If we introduce paid plans, we&apos;ll
          tell you at least 30 days ahead, and nothing will be charged without your agreement.
        </p>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>
          Don&apos;t misuse SeatMate: no fake listings, spam, scraping, attempts to break into accounts
          or systems, or anything illegal. We may suspend or close accounts that do.
        </p>
      </section>

      <section>
        <h2>Ending your account</h2>
        <p>
          You can stop using SeatMate at any time. Email us and we&apos;ll remove your listing and
          business data. We may close an account that breaks these terms, and will tell you why
          unless the law stops us.
        </p>
      </section>

      <section>
        <h2>Our service</h2>
        <p>
          SeatMate is provided &ldquo;as is&rdquo;. We work to keep it running and accurate but
          can&apos;t promise it will always be available or error-free. To the extent the law allows,
          SeatMate isn&apos;t liable for lost profits or for indirect or consequential losses from using
          it.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms as SeatMate grows. We&apos;ll change the date above and email
          business owners about important changes. Continuing to use the portal means you accept
          the new terms.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of the State of California.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </ProsePage>
  );
}
