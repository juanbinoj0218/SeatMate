import type { Metadata } from "next";
import Link from "next/link";

import { consumerUrl } from "@seatmate/shared/site-urls";

import { ProsePage } from "@/components/site-chrome";
import { CONTACT_EMAIL } from "@/lib/site-info";

export const metadata: Metadata = {
  title: "Privacy Policy – SeatMate for Business",
  description: "What the SeatMate business portal collects about businesses and staff, and why.",
};

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy" updated="October 1, 2026">
      <p>
        This policy explains what SeatMate collects when a business owner or staff member uses the
        business portal at seatmate360.net, and what we do with it. We collect only what the
        product needs, we don&apos;t sell your data, and we don&apos;t show ads. Customers using
        seatmate360.com are covered by the <a href={consumerUrl("/privacy")}>customer privacy policy</a>.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Owner account</strong>: your name, email address and password (stored securely by
            Google Firebase), or your Google profile if you sign in with Google. If you turn on
            two-factor sign-in, Firebase also stores the authenticator app link for it.
          </li>
          <li>
            <strong>Business details</strong>: name, address, business type, opening hours, cover photo
            and floor plan.
          </li>
          <li>
            <strong>Live updates</strong>: which seats, tables and games are open or in use, and when they
            last changed.
          </li>
          <li>
            <strong>Staff</strong>: the name and email of each person you invite, and the updates they make.
          </li>
          <li>
            <strong>Page counts</strong>: daily totals of views, saves and QR code scans for your
            listing. These aren&apos;t linked to individual customers.
          </li>
        </ul>
      </section>

      <section>
        <h2>What&apos;s public</h2>
        <p>
          Once your business is approved, its name, address, type, hours, cover photo, floor plan and
          live availability are shown to anyone on seatmate360.com and in the SeatMate app. Your
          account email, staff list and page counts stay private to you and SeatMate.
        </p>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run your listing and show customers your live availability.</li>
          <li>To review new businesses before they go public.</li>
          <li>To send account emails, such as password resets, staff invites and update reminders.</li>
          <li>To keep the service secure and fix problems.</li>
        </ul>
      </section>

      <section>
        <h2>Services we rely on</h2>
        <ul>
          <li>Google Firebase for sign-in and our database, including your cover photo.</li>
          <li>Vercel to host the websites.</li>
          <li>Resend to send emails.</li>
        </ul>
        <p>They process data only to provide their service to us.</p>
      </section>

      <section>
        <h2>Cookies and storage</h2>
        <p>
          We use your browser&apos;s storage to keep you signed in. We don&apos;t use advertising or
          cross-site tracking cookies.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>Edit your business details, hours, photo and floor plan any time from the dashboard.</li>
          <li>Remove a staff member from the Staff page, which ends their access.</li>
          <li>
            To delete your business and account, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address on the account.
            We&apos;ll remove your listing and business data, except what the law requires us to keep.
          </li>
          <li>
            California residents can ask what we hold about them and ask us to delete it. We
            don&apos;t sell or share personal information for advertising.
          </li>
        </ul>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If this policy changes, we&apos;ll update the date above. Questions? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our{" "}
          <Link href="/terms">Terms and Conditions</Link>.
        </p>
      </section>
    </ProsePage>
  );
}
