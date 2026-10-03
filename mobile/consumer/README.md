# SeatMate (customer app, Expo)

The customer website (seatmate360.com) as an iOS and Android app, built with
Expo SDK 57 and Expo Router. It uses the same Firebase project and data as
the website, so seat counts are live from the businesses, and a customer's
account, saved places and history are the same in the app and on the site.

## What's in it

| Screen | What it does |
| --- | --- |
| Explore (`/`) | Greeting, search bar, category tiles, live "open seats right now" carousel (open places with a free seat), "Jump back in" (recently viewed), every SeatMate spot sorted open-first and most-open-first, "Suggest a place" |
| Search (`/search`) | Search by name, type, street or ZIP; filters (open seats, cafés, restaurants, bars, barbershops, bowling); "Open now"; sort by most open, just updated or A–Z |
| Place (`/place/[slug]`) | Photo, live seats with % open and freshness ("Updated 3 minutes ago", stale warning), open/closed and today's hours, bar crowd level from the door counter, barber chairs with live timers, pool/darts/lanes in use, the live floor plan (zoomable), weekly hours, save, share, directions, "Email me when a seat opens" on full places |
| Saved (`/saved`) | Saved places with live seats; tab badge with the count |
| Account (`/account`) | Profile, stats, recently viewed (clear), your details, links to suggest/contact/business/about/privacy/terms, sign out, delete account |
| Sign in (`/login`) | Email/password, create account, forgot password, Google, authenticator-app code for accounts with two-step sign-in |
| Your details (`/profile`), Suggest a place (`/suggest`), Contact (`/contact`), Delete account (`/delete-account`) | Same fields and Firestore documents as the website's pages |

Everything live uses Firestore listeners, so seats, games, chair timers and
the crowd level change on screen as staff update them in the business app
or portal.

### Data it reads and writes (same as the website)

- `publicBusinesses/{slug}`: the listed places (name, type, address, photo, hours, time zone)
- `businesses/{id}/tables`, `floorMarkers`, `live/door`: seats, floor plan, games, bar crowd (read only)
- `users/{uid}` and `users/{uid}/favorites/{slug}`: profile, home ZIP, recently viewed, saved places
- `seatAlerts/{uid}_{slug}`: "Email me when a seat opens" (the business site sends the email)
- `publicBusinesses/{slug}/stats/{day}`: `views` and `saves` for the business's analytics
- `placeRequests`, `contactMessages`: the suggest and contact forms
- `settings/features`: the admin site's feature switches (seat alerts, suggest, contact form, share)

Plain helpers come from `packages/shared` (business hours, floor-plan
markers, table geometry, crowd level, seat alerts, feature switches) through
`metro.config.js`, so the app and website count and draw the same way. Only
React-free files that don't import the website's Firebase setup can be used.

## Running it

The app lives outside the npm workspaces because Expo pins its own React
version, so install it on its own:

```bash
cd mobile/consumer
npm install
npx expo start         # scan the QR code with Expo Go, or press i / a
```

Create `mobile/consumer/.env` with the same Firebase web config as the
websites (Firebase → Project settings → Your apps):

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
# Optional
EXPO_PUBLIC_CONSUMER_SITE_URL=https://seatmate360.com
EXPO_PUBLIC_BUSINESS_SITE_URL=https://seatmate360.net
EXPO_PUBLIC_CONTACT_EMAIL=admin@seatmate360.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

Checks: `npx tsc --noEmit` and `npx expo lint`.

Google sign-in works in the browser preview as-is. On phones it needs OAuth
client IDs (`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`); without them the button is
hidden and Google accounts can add a password with "Forgot password?".
Turning two-step sign-in on or off stays on the website's account page.

## Browser preview on Vercel

`npx expo export --platform web` builds the app as a website in `dist/`.
For a preview link on every pull request, add a Vercel project with Root
Directory `mobile/consumer` (settings come from `vercel.json`), the
`EXPO_PUBLIC_FIREBASE_*` variables, and add its domain to Firebase →
Authentication → Authorized domains.

## Publishing to the App Store and Google Play

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios      # or android
```

Bundle IDs are `com.seatmate360.app` (iOS and Android) in `app.json`. The
icons in `assets/` are placeholders shared with the business app; replace
them with SeatMate artwork before submitting. Once the app is live, set
`NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_ANDROID_APP_URL` on the website so
its download badges link to the stores.
