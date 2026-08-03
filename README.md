# sensus

A personal word library for saving queries, discovering their nuances, and coming back to them later.

## Features

- Onboarding with a unique `@nickname` as the library identifier.
- Recovery code for accessing the profile again.
- Editorial home screen with light, dark, and system themes.
- Paper texture and a science-fiction-book-inspired serif typeface.
- Local-first storage: words remain available without an internet connection.
- Automatic queue delivery and manual retry when connectivity returns.
- Up to 3 concise definitions per word, always with a usage example.
- Asynchronous processing with OpenAI `gpt-4o-mini`.
- Library ordered by date, processing status, and deletion controls.
- Text search across words, categories, definitions, and examples.
- No traditional authentication: an access key and recovery code are associated with the nickname.

## Stack

- Expo SDK 57 + Expo Router
- Expo Web for the deployed client
- NativeWind/Tailwind for the styling foundation
- Convex for the database, queries, and mutations
- Convex Workpool for background jobs
- OpenAI `gpt-4o-mini`
- `localStorage` on web; SQLite + SecureStore on iOS

## Requirements

- Node.js 20+
- npm
- A Convex account for a hosted deployment
- An OpenAI API key
- Vercel CLI if you want to deploy from the terminal

## Local installation

```bash
npm install
cp .env.example .env.local
```

Configure `.env.local`:

```bash
EXPO_PUBLIC_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://YOUR_DEPLOYMENT.convex.site
```

The `OPENAI_API_KEY` variable must only exist as an environment variable on the Convex deployment; never commit it to `.env.local` or expose it to the client.

Start the backend and client in separate terminals:

```bash
npx convex dev
npm run web
```

To generate the static site:

```bash
npm run export:web
```

## Convex deployment

```bash
npx convex login
npx convex deploy
npx convex env set OPENAI_API_KEY "your-api-key"
```

Use the resulting `*.convex.cloud` URL as `EXPO_PUBLIC_CONVEX_URL`.

## Vercel deployment

The project uses `vercel.json` to run `npm run vercel-build` and publish `dist/`.

Configure these variables in Vercel for Production, Preview, and Development:

```text
EXPO_PUBLIC_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://YOUR_DEPLOYMENT.convex.site
```

After saving the variables, create a new deployment. Vercel will install dependencies with `npm ci`, export the web build, and serve the static output.

## Checks

```bash
npm run typecheck
npm run check
npx expo-doctor
npm run export:web
```

## Architecture overview

The client immediately stores a local entry with an `offline-pending`, `syncing`, or `processing` status. Convex creates the record and queues processing in Workpool; the OpenAI action normalizes the result and a callback updates the final status. The library reconciles periodically and whenever connectivity returns.

## Security note

This is a personal project and does not use Convex Auth. The access key works as a bearer credential and is stored locally; it should not be exposed in logs or reused for a public multi-user application without sessions, rate limiting, and a security review.
