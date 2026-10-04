import type { Metadata } from "next";
import Link from "next/link";

import ProsePage from "@/components/prose-page";
import { CONTACT_EMAIL } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Terms of Service – SeatMate",
  description: "The terms for using SeatMate.",
};

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Service" updated="September 28, 2026">
      <p>
        These terms cover your use of SeatMate: seatmate360.com, the business portal at
        seatmate360.net and the SeatMate app. By using SeatMate, you agree to them.
      </p>

      <section>
        <h2>Seat information is a guide</h2>
        <p>
          Seat availability comes from each business and its staff and can change at any moment. A
          seat shown as open is not a reservation, and we can&apos;t guarantee it&apos;s free when you
          arrive. Always check opening hours and details with the business if it matters.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate information and keep your password safe.</li>
          <li>You&apos;re responsible for activity on your account.</li>
          <li>You can stop using SeatMate or ask us to delete your account at any time.</li>
        </ul>
      </section>

      <section>
        <h2>Businesses</h2>
        <ul>
          <li>Only list a business you own or are authorized to manage.</li>
          <li>Keep your floor plan, hours and seat updates reasonably accurate.</li>
          <li>You&apos;re responsible for the staff you invite and what they post.</li>
          <li>We review businesses before they appear publicly and may decline, hide or remove a listing.</li>
        </ul>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>
          Don&apos;t misuse SeatMate: no fake listings or seat updates, spam, scraping, attempts to break
          into accounts or systems, or anything illegal. We may suspend accounts that do.
        </p>
      </section>

      <section>
        <h2>Our service</h2>
        <p>
          SeatMate is provided &ldquo;as is&rdquo;. We work to keep it running and accurate but
          can&apos;t promise it will always be available or error-free. To the extent the law allows,
          SeatMate isn&apos;t liable for indirect or consequential losses from using it, including a
          trip to a place that turned out to be full.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms as SeatMate grows. We&apos;ll change the date above, and
          continuing to use SeatMate means you accept the new terms.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use our{" "}
          <Link href="/contact">contact form</Link>. See also our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </ProsePage>
  );
}
