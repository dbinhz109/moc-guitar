# Mộc Guitar Studio

A beginner guitar learning website with English as the default language and a complete Vietnamese interface.

## What you can do

- Create an account using a username and password; sign in and sign out.
- Save lesson progress to your account and continue in another browser or device.
- Follow three guided lessons with chord diagrams and a metronome.
- Browse six basic chords and two built-in learning resources.
- Upload, read and delete PDF, image and text documents (up to 10 MB each).
- Choose **Learn this song** to extract chord names, review the progression and create guided practice sections. PDF text extraction and browser OCR for images/scanned PDF pages are supported.

Documents stay in IndexedDB in the current browser, separated by account. Guest documents and progress are preserved separately. Practice plans are saved with each document. Chord extraction must be reviewed before starting; practice uses one chord per bar and suggested downstrokes. It does not transcribe exact timing, melody, staff notation or guitar tabs. Unsupported chord shapes are shown and require correction before practice. Accounts do not require email; password recovery is not included.

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
npm run test:practice
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

## Learning from documents

Use **My library → Upload → Learn this song**. For PDFs, choose the page to read. Review the extracted text and chord order, adjust the practice tempo/meter, then build the practice plan. Practice sections contain up to four chord changes, chord diagrams, string/fret instructions and an audible metronome that highlights the current chord. Repeated chords are preserved. Finish each section and resume later in the same browser.

PDF.js and Tesseract.js browser assets are generated from pinned npm dependencies by `npm run prebuild` (also run automatically by `npm run build`). `npm run prebuild` is needed once before a fresh development preview. OCR downloads English recognition data from the Tesseract.js data CDN on first use; document recognition itself runs in the browser. English data is used for Latin chord names; recognized lyrics may need correction.
