# SeatMate

Live seating availability for cafés, restaurants and bars. The repo holds
three Next.js sites that share one Firebase project:

| Folder | Site | Pages |
| --- | --- | --- |
| `apps/consumer` | Customer site (seatmate360.com) | `/`, `/about`, `/search`, `/place/[slug]`, `/places`, `/places/[city]`, `/suggest`, `/contact`, `/faq`, `/privacy`, `/terms`, `/account`, `/login`, `/auth/action`, `/api/place-details` |
| `apps/business` | Business portal (seatmate360.net) | `/business/*`, `/staff/*`, `/api/seat-alerts` |
| `apps/admin` | Admin site (seatmate360.info) | `/` overview, `/businesses`, `/inbox`, `/customers`, `/admins`, `/login`, `/api/admin/*` |
| `mobile/consumer` | Customer app for iOS and Android (Expo) | Search, live seats and floor plans, saved places, seat-open push notifications; see [`mobile/consumer/README.md`](mobile/consumer/README.md) |
| `mobile/business` | Business app for iOS and Android (Expo) | Same features as the business portal; see [`mobile/business/README.md`](mobile/business/README.md) |
| `packages/shared` | Shared code | Firebase setup, `BackButton`, `SeatMateMark` logo, floor-plan marker config, global styles, cross-site URLs |

## Local development

```bash
npm install              # once, from the repo root
npm run dev:consumer     # http://localhost:3000
npm run dev:business     # http://localhost:3001
npm run dev:admin        # http://localhost:3002
```

`npm run build` and `npm run lint` run for all apps.

The two Expo apps in `mobile/` each have their own `npm install` (Expo pins
its own React version, so they stay out of the npm workspaces). Run them
with `npx expo start` from their folder.

## Environment variables

Both apps need the Firebase settings:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

If `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is missing, it defaults to
`<projectId>.firebaseapp.com` (needed for Google sign-in).

Each site links to the other by absolute URL:

| App | Variable | Notes |
| --- | --- | --- |
| consumer | `GOOGLE_MAPS_API_KEY` | Google reviews on place pages |
| consumer | `NEXT_PUBLIC_BUSINESS_SITE_URL` | Optional; defaults to `https://seatmate360.net` |
| business | `NEXT_PUBLIC_CONSUMER_SITE_URL` | Optional; defaults to `https://seatmate360.com` |
| consumer | `NEXT_PUBLIC_CONTACT_EMAIL` | Optional; shown on Contact, Privacy and Terms. Defaults to `admin@seatmate360.com` |
| consumer | `NEXT_PUBLIC_IOS_APP_URL` | Optional; App Store link. Shows "Coming soon" until set |
| consumer | `NEXT_PUBLIC_ANDROID_APP_URL` | Optional; Google Play link. Shows "Coming soon" until set |

In `npm run dev` the sites link to `http://localhost:3000` / `http://localhost:3001`.

## Deploying on Vercel

One Vercel project per app, both connected to this repo:

- **Consumer project**: Root Directory `apps/consumer`.
- **Business project**: Root Directory `apps/business`, with `seatmate360.net`
  attached as its domain.

Old business links on the consumer domain (`/business/...`, `/staff/...`,
`/admin`, including staff invite links) redirect to the same path on the
business site.

Add `seatmate360.net` to Firebase → Authentication → Settings →
Authorized domains, or Google sign-in will fail there.

## Customer accounts

Accounts on the consumer site are optional. Signed-in customers can save
places, set a home ZIP and see recently viewed places. Sign-in uses the same
Firebase Authentication project (Google and email/password).

Data lives under `users/{uid}`:

- `users/{uid}`: `displayName`, `homeZip`, `recentlyViewed` (latest 8 places)
- `users/{uid}/favorites/{slug}`: one document per saved place

## Firestore rules

The full rules live in [`firestore.rules`](firestore.rules). Paste the whole
file into Firebase → Firestore → Rules and publish whenever it changes. It
covers businesses, staff, customer accounts, seat alerts and analytics.

Google sign-in also needs the site's domain (e.g. `seatmate360.com`) under
Firebase → Authentication → Settings → Authorized domains.

## Password reset emails

"Forgot password?" on both sites sends Firebase's reset email. To have the
link open SeatMate's own "choose a new password" page (`/auth/action` on the
customer site) instead of Firebase's default page, set Firebase →
Authentication → Templates → Password reset → Customize action URL to
`https://seatmate360.com/auth/action`. Emails come from
`noreply@<project>.firebaseapp.com` and often land in spam until a custom
sender domain is set on the same Templates page.

## Seat-open alerts

Customers can ask to be emailed when a full place has an open seat. When
staff mark a seat open, the business site's `/api/seat-alerts` route emails
everyone waiting and turns their alert off. Alerts expire after 12 hours.

The business Vercel project needs:

| Variable | Notes |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | The JSON from Firebase → Project settings → Service accounts → Generate new private key, pasted as one line |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) (free tier is enough to start) |
| `ALERT_EMAIL_FROM` | e.g. `SeatMate <alerts@seatmate360.com>` once the domain is verified in Resend |

Without them, alerts are saved but no email is sent. In `npm run dev` the
email is printed to the terminal instead.

## Analytics

- `publicBusinesses/{slug}/stats/{YYYY-MM-DD}`: page views, saves and QR
  scans, counted by customers' browsers (rules only allow +1).
- `businesses/{id}/stats/{YYYY-MM-DD}`: seat updates and how full the place
  was at each hour, written when staff change a seat.

Owners see both on `/business/analytics`. The QR sign on `/business/qr`
links to the place page with `?ref=qr` so scans can be counted.

## Suggestions, contact messages and SEO

- "Suggest a place" (`/suggest`) saves to `placeRequests`; the contact form
  (`/contact`) saves to `contactMessages`. Anyone can send, only admins can
  read. Admins see both on the business site at `/admin/inbox`, with
  repeated requests for the same place grouped together.
- City pages (`/places`, `/places/[city]`), `sitemap.xml`, `robots.txt`
  and link previews (Open Graph images) are rendered on the server from
  `publicBusinesses` through Firestore's REST API, cached for 5 minutes.

## Admin site (`apps/admin`)

A separate site for SeatMate admins (anyone with `admins/{uid}.active == true`):

- **Overview**: customers, live places, seats open now, page views, saves,
  QR scans, seat updates, new customers and new businesses per day (7/30/90
  days), top places, and a "needs attention" list (approvals waiting, new
  requests and messages, live places with stale or missing seat data).
- **Businesses**: approve, reject, suspend and delete businesses and review
  floor plans (moved here from the business site's `/admin`).
- **Inbox**: place requests and contact messages.
- **Customers**: every account with its role, sign-up and last sign-in
  dates, saved places and home ZIP; search and filter; disable/enable an
  account; copy a password reset link.
- **Admins**: add an admin by email, remove admin access.
- **Business pages** (`/businesses/[id]`): edit name, type, address, ZIP
  and Google Place ID (the live listing updates too), remove a cover photo,
  30-day views/saves/scans/seat updates, busiest hours, seats now, owner
  and staff, and that business's admin history.
- **Seat-update reminders**: "Send reminder" on places with no seat update
  in 24 h emails the owner (via `RESEND_API_KEY` in the admin project) or
  opens a ready-to-send email in your own mail app if Resend isn't set up.
- **Activity**: every admin action (approvals, edits, account changes,
  reminders, settings) with who did it and when (`adminLog` collection).
- **Settings**: feature switches for the customer site (seat alerts,
  suggest a place, contact form, share button, app buttons), stored in
  `settings/features`.

Setup on Vercel: a third project with Root Directory `apps/admin` and your
`seatmate360.info` as its domain. It needs the same `NEXT_PUBLIC_FIREBASE_*` variables plus
`FIREBASE_SERVICE_ACCOUNT_KEY` (Overview, Customers and Admins read data on
the server). Add `seatmate360.info` to Firebase → Authentication → Settings →
Authorized domains. The old `/admin` links on the other two sites forward to
the admin site.
