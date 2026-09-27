# SeatMate

Live seating availability for cafés and restaurants. The repo holds two
Next.js sites that share one Firebase project:

| Folder | Site | Pages |
| --- | --- | --- |
| `apps/consumer` | Customer site (seatmate360) | `/`, `/about`, `/search`, `/place/[slug]`, `/api/place-details` |
| `apps/business` | Business portal (separate domain) | `/business/*`, `/staff/*`, `/admin` |
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

Each site links to the other, so each needs the other's address (no
trailing slash). On Vercel the build stops with an error if it is missing.

| App | Variable | Example |
| --- | --- | --- |
| consumer | `NEXT_PUBLIC_BUSINESS_SITE_URL` | `https://your-business-domain.com` |
| consumer | `GOOGLE_MAPS_API_KEY` | Google reviews on place pages |
| business | `NEXT_PUBLIC_CONSUMER_SITE_URL` | `https://seatmate360.com` |

Locally these default to `http://localhost:3000` / `http://localhost:3001`.

## Deploying on Vercel

One Vercel project per app, both connected to this repo:

- **Consumer project**: Root Directory `apps/consumer`.
- **Business project**: Root Directory `apps/business`, with the business
  domain attached.

Old business links on the consumer domain (`/business/...`, `/staff/...`,
`/admin`, including staff invite links) redirect to the same path on the
business site.

Add the business domain to Firebase → Authentication → Settings →
Authorized domains, or Google sign-in will fail there.
