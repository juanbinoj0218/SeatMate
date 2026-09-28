# SeatMate (iPhone app)

Live seat availability for cafés and restaurants. Customers search places,
see how many seats are free right now, and view each place's live floor plan.

Uses the same Firebase project as the SeatMate websites
(`juanbinoj0218/SeatMate`), so accounts and saved places are shared.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app to open it in Expo Go.

Firebase settings go in `.env.local` (not committed):

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

## Screens

- `src/app/index.tsx`: home (search, group size, filters)
- `src/app/place/[slug].tsx`: a place's live seats and floor plan
- `src/app/login.tsx`: sign in / create account
- `src/app/account.tsx`: saved places, recently viewed, profile, delete account
