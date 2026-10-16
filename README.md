# Mộc Guitar Studio

A beginner guitar learning website with English as the default language and a complete Vietnamese interface.

## What you can do

- Create an account using a username and password; sign in and sign out.
- Save lesson progress to your account and continue in another browser or device.
- Follow three guided lessons with chord diagrams and a metronome.
- Browse six basic chords and two built-in learning resources.
- Upload, read and delete PDF, image and text documents (up to 10 MB each).

Documents stay in IndexedDB in the current browser, separated by account. Guest documents and progress are preserved separately. Uploaded documents do not automatically become lessons. Accounts do not require email; password recovery is not included.

## Development

Requires Node.js >=22.13.0.

```sh
npm ci
npm run db:generate # only after changing db/schema.ts
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_spotty_steve_rogers.sql
npm start -- --port 4173
```

Open http://127.0.0.1:4173. Apply each new migration once, in order. Local and production databases are separate.

For subsequent UI development, `npm run dev` starts the Vinext development server. Build after changing hosting bindings before applying local migrations.

## Validation

Against the running local preview:

```sh
npm run test:api
npx tsc --noEmit
node --check public/app.js
```

The API tests create disposable accounts in local D1. They cover registration, validation, session rotation/invalidation, account ownership, progress isolation, cross-origin rejection and login rate limits. `MOC_TEST_BASE_URL` can select another loopback preview URL.

## Implementation

- Vinext on Cloudflare Workers; Cloudflare D1 stores accounts, sessions and progress.
- `studio.html` and `public/` contain the interface. `app/route.ts` serves the HTML.
- `lib/account.ts` handles authentication; API handlers live in `app/api/`.
- Passwords use salted scrypt (N=32768, r=8, p=3). Plaintext passwords are never stored.
- Sessions use random tokens in HttpOnly, SameSite=Lax cookies, Secure on HTTPS, with a seven-day expiry. Only token hashes are stored in D1.
- Login/registration requests have server-side rate limits and origin checks.
- Only the authenticated account can update its progress. Browser clients cannot supply another account ID to bypass this check.

Sites hosting is configured in `.openai/hosting.json`. Its platform access policy is separate from the website's username/password accounts. Deployment applies the checked-in Drizzle migrations before publishing. Do not commit local databases, credentials, `.env` files or build artifacts.
