# SeatMate Business (Expo app)

The business portal (seatmate360.net) as an iOS and Android app, built with
Expo SDK 57 and Expo Router. It uses the same Firebase project and data as
the web portal, so owners and staff can switch between the two freely.

## What's in it

| Screen | Who | What it does |
| --- | --- | --- |
| Sign in (`/login`) | Everyone | Email/password sign-in, create account, password reset |
| Setup (`/setup`) | New owners | Add business name, type, address and ZIP (saved as a draft) |
| Dashboard (`/dashboard`) | Owners | Approval status, live seat count, stale-seat reminder, links to everything below |
| Floor plan (`/floor-plan`) | Owners | **Live seats**: tap seats open/taken on the floor plan or a list. **Edit layout**: add tables, round tables, bar stools and markers; drag to move; rename, add/remove seats, resize, rotate, delete. Submit for approval |
| Staff (`/team`) | Owners | Create a one-time invite link (share sheet + copy), enable/disable staff |
| Business hours (`/hours`) | Owners | Opening hours per day; synced to the customer page once live |
| Analytics (`/analytics`) | Owners | Page views, saves, QR scans, seat updates, busiest hours (7/30 days) |
| QR code (`/qr`) | Owners of live places | QR code for the customer page (tagged `?ref=qr`), share link |
| Staff console (`/staff`) | Staff | Live seat tapping for their business, with the stale-seat reminder |
| Join (`/join`, `/staff/join/[id]`) | Invited staff | Paste an invite link and accept it |

Seat changes use the same transaction, daily analytics and seat-alert
emails (`POST https://seatmate360.net/api/seat-alerts`) as the web portal.
Table layout math comes from `packages/shared/src/table-geometry.ts`, so
tables look the same in the app and on the web.

Not in the app yet (use the website): Google sign-in, cover photo upload
and the printable QR sign.

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
