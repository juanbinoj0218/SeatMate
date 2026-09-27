# SeatMate

Live seating availability for cafés and restaurants. The repo holds two
Next.js sites that share one Firebase project:

| Folder | Site | Pages |
| --- | --- | --- |
| `apps/consumer` | Customer site (seatmate360.com) | `/`, `/about`, `/search`, `/place/[slug]`, `/api/place-details` |
| `apps/business` | Business portal (seatmate360.net) | `/business/*`, `/staff/*`, `/admin` |
| `packages/shared` | Shared code | Firebase setup, `BackButton`, `HomeButton`, global styles, cross-site URLs |

## Local development

```bash
npm install              # once, from the repo root
npm run dev:consumer     # http://localhost:3000
npm run dev:business     # http://localhost:3001
```

`npm run build` and `npm run lint` run for both apps.

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

Each site links to the other by absolute URL:

| App | Variable | Notes |
| --- | --- | --- |
| consumer | `GOOGLE_MAPS_API_KEY` | Google reviews on place pages |
| consumer | `NEXT_PUBLIC_BUSINESS_SITE_URL` | Optional; defaults to `https://seatmate360.net` |
| business | `NEXT_PUBLIC_CONSUMER_SITE_URL` | Optional; defaults to `https://seatmate360.com` |

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
