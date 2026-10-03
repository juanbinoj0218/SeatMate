# SeatMate Business (Expo app)

The business portal (seatmate360.net) as an iOS and Android app, built with
Expo SDK 57 and Expo Router. It uses the same Firebase project and data as
the web portal, so owners and staff can switch between the two freely.

## What's in it

Signing in with an account made on seatmate360.net loads the same business,
floor plan, staff, hours and analytics: the app reads and writes the same
Firestore documents as the web portal (`businesses/{uid}`,
`staffUsers/{uid}`, `businesses/{id}/tables`, `floorMarkers`, `live/door`,
`stats`), so a change in either shows up in the other straight away.

| Screen | Who | What it does |
| --- | --- | --- |
| Sign in (`/login`) | Everyone | The business portal's opening page: features, "what customers see", then sign in with email/password or Google, a two-factor code if the account has one, create account, password reset |
| Setup (`/setup`) | New owners | Business name, type (same list as the website, incl. barbershop and bowling alley), address and ZIP (saved as a draft) |
| Dashboard (`/dashboard`) | Owners | Approval status, seats open now, views and seat updates today, stale-seat reminder. Tuned per business type: bouncer mode for bars, tap-to-toggle chairs with timers for barbershops, lanes and games for bowling alleys and bars |
| Floor plan (`/floor-plan`) | Owners | **Live seats**: tap seats open/taken (map or list); tap pool tables, darts and lanes to mark them in use. **Edit layout**: tables, round tables, bar stools, barber chairs (barbershops), markers incl. lanes (bowling alleys); drag, rename, add/remove seats, resize, rotate, delete. Submit for approval |
| Door counter (`/door`) | Bar owners and staff | Bouncer mode: +1 / −1 at the door, crowd level customers see, reset |
| Staff (`/team`) | Owners | One-time invite link (share sheet + copy), enable/disable staff |
| Business hours (`/hours`) | Owners | Opening hours per day; synced to the customer page once live |
| Analytics (`/analytics`) | Owners | Page views, saves, QR scans, seat updates, busiest hours (7/30 days) |
| QR code (`/qr`) | Owners of live places | QR code for the customer page (tagged `?ref=qr`), share link |
| Staff console (`/staff`) | Staff | Live seats and games for their business, door counter when bouncer mode is on |
| Join (`/join`, `/staff/join/[id]`) | Invited staff | Paste an invite link and accept it |

Seat changes use the same transaction (including barber chair timers),
daily analytics and seat-alert emails (`POST https://seatmate360.net/api/seat-alerts`)
as the web portal. Table layout math (`table-geometry.ts`), markers and
business types (`floor-plan.ts`) and the crowd level (`door-crowd.ts`) come
from `packages/shared`, so the app and the website draw and count the same way.

Still on the website (the dashboard links there): turning two-factor sign-in
on or off, cover photo upload and the printable QR sign.

## Running it

The app lives outside the npm workspaces because Expo pins its own React
version, so install it on its own:

```bash
cd mobile/business
npm install
cp .env.example .env   # fill in the same Firebase values as the web sites
npx expo start         # scan the QR code with Expo Go, or press i / a
```

`.env` needs the `EXPO_PUBLIC_FIREBASE_*` values from Firebase → Project
settings → Your apps (the web app config works). The site URLs default to
the live sites.

Checks: `npx tsc --noEmit` and `npx expo lint`.

Google sign-in works in the browser preview as-is. On phones it needs OAuth
client IDs (`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`, see `.env.example`); without
them the button is hidden and Google accounts can add a password with
"Forgot password?".

## Browser preview on Vercel

`npx expo export --platform web` builds the app as a website in `dist/`.
To get a preview link for every pull request, add a Vercel project with Root
Directory `mobile/business` (settings come from `vercel.json`), the
`EXPO_PUBLIC_FIREBASE_*` variables, and add its domain to Firebase →
Authentication → Authorized domains.

## Publishing to the App Store and Google Play

Builds run in the cloud with EAS (no Xcode or Android Studio needed):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios      # or android
```

Bundle IDs are `com.seatmate360.business` (iOS and Android) in `app.json`.
Replace the placeholder icons in `assets/` with SeatMate artwork before
submitting.
