# Mộc Guitar Studio

A beginner guitar learning studio, English by default with Vietnamese localization.

## Learn from a document

1. Open **My library** and upload MusicXML (`.musicxml`, `.xml`, `.mxl`), PDF, PNG/JPEG/WebP or UTF-8 text/Markdown (up to 10 MB).
2. The document viewer includes **Review chords & learn**. The review screen keeps the original beside the editable plan, with image zoom and PDF page selection.
3. Review candidate chord labels. Image reading detects staff bands and reads the labels above them when possible. Results are never treated as verified automatically; an empty result explicitly says no lesson was created.
4. Confirm the source meter: 2/4, 3/4, 4/4 or 6/8. Unknown meters remain unselected.
5. Enter chord durations and bars, or explicitly apply **one-bar practice timing** for a simplified exercise.
6. Confirm your review, then save and practice. Playback follows the declared bars, durations and section repeats, with optional synthesized chord changes and separate chord previews.

Example in 2/4:

```text
Verse x2
C:1 G:1 | Am:2

Chorus
F:2 | C:2
```

`|` separates bars. `C:2` holds C for two counts; `C:?` means duration unknown and blocks playback. `-:1` is a one-count rest. Every bar must total the meter numerator. In 6/8, each click counts an eighth note. Names such as Verse/Chorus/Intro/Bridge/Outro/Section label sections; `x2` repeats a section twice.

A line with chord durations and no `|` represents one bar: `C:1 G:1` is a complete 2/4 bar, including after saving and reopening a plan. Separate timed lines represent separate bars. An untimed list such as `C G Am F` remains provisional until durations are entered or simplified timing is explicitly applied.

The app teaches chord accompaniment. It does not automatically transcribe staff notes, melody, exact strumming patterns, repeat signs drawn on a score or guitar tablature. Image recognition can miss or confuse chord names, particularly in small images. Always compare against the displayed source. Automatically detected score sections correspond to staff lines and require review.

### MusicXML notes and chord symbols

MusicXML **score-partwise** files can provide written pitches and timing directly, without OCR. Choose a part, then **Chord accompaniment** or **Written notes**; note mode also offers voice selection. Plain XML and compressed MXL (using the declared container root) are supported. The library includes an original downloadable sample, **First Steps**.

- Chord mode reads harmony symbols and their offsets, carrying held chords into the following bars.
- Note mode reads durations, rests, simultaneous notes, divisions and voice movement. Instrument transposition is applied to obtain sounding pitches. Each note has a suggested standard-guitar string/fret position and synthesized playback; positions for simultaneous notes are individual suggestions, not an automatically solved chord fingering.
- Simple bar repeats are expanded into playing order. Imports with alternate endings or D.C./D.S. are shown in written bar order and explicitly require manual review. Tempo changes use one chosen practice speed.
- Supported meters remain 2/4, 3/4, 4/4 and 6/8. Mixed meters, pickup/overfull bars, unsupported harmony kinds and notes outside E2–E6 are flagged for adjustment. No missing durations or pitches are invented. `score-timewise`, percussion interpretation and full articulation/tablature import are not supported.
- Note-plan text uses `@E4:1` for E4 held one count and `@E4+G4:2` for two simultaneous notes held two counts. Note events round-trip through saved plans. Exercises are limited to 512 events. MusicXML unpacking is bounded to 4 MB and 30,000 XML elements.

### Correct image labels in place

Detected staff-label word boxes become clickable markers on PNG/JPEG/WebP originals. Click to correct or delete a label, or point at the image to add a missing chord. An optional duration field updates the editable plan. Every correction clears the review confirmation. Hide markers to inspect the unchanged original, or zoom in for small labels. Lower OCR confidence is shown in amber; all candidates still require review. If the plan text is edited directly, old markers are cleared to avoid attaching them to the wrong event. PDF review retains the original viewer; in-place markers currently apply to image files.

### Three steps for each section

Practice is organized into **positions/shapes → neighboring changes → full section**. Change previews use the actual neighboring sounds in that section. A practice-speed slider and the current learning step are saved with the plan and sync to the account. Completion remains self-reported; there is no microphone grading. Images still supply chord candidates rather than automatically transcribed melodies.

PDF reading works on the selected page; it does not assemble a whole multi-page song automatically. Practice guidance combines chord shapes, string/fret directions, reference audio and timing exercises, rather than generating a complete song-specific course. See [the document-library review](docs/library-review.md) for verification results and recognition limitations.

## Accounts and library storage

- Username/password registration, sign-in and sign-out. No email is required; password recovery is not included.
- Cloudflare D1 stores accounts, sessions, lesson progress, document metadata and practice plans.
- R2 stores each account's original documents. Library records and plans sync across browsers/devices after signing in.
- Existing account-scoped browser documents migrate to that same account. Guest files remain local until the user explicitly chooses **Import browser files**; guest originals are retained.
- Guest documents and plans use IndexedDB. Clearing browser data removes guest data.
- Account library limits: 100 files, 200 MB total, 10 MB per file. Requests enforce session ownership, file signatures, origin checks and revision checks for concurrent plan editing.
- Three built-in lessons, a six-chord reference, two reading resources and a standalone metronome remain available.

## Run locally

Requires Node.js >=22.13.0.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_spotty_steve_rogers.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_optimal_stone_men.sql
npm start -- --port 4173
```

Apply each migration once, in order. Local D1/R2 and hosted resources are separate. `npm run dev` starts a development server after the initial build/assets setup. Generate new migrations with `npm run db:generate` after changing `db/schema.ts`.

## Validate

```sh
npm run test:practice
npm run test:musicxml
npx tsc --noEmit
node --check public/library.js
node --check public/document-reader.js
node --check public/practice-guide.js
```

Against a running local preview:

```sh
npm run test:api
npm run test:library
```

API tests create disposable accounts in local D1/R2. `MOC_TEST_BASE_URL` selects another loopback preview. Tests cover authentication/session ownership, file ownership and content checks, import deduplication, optimistic revisions, isolated chord labels, unknown meter, 2/4 timing, bars and section repeats.

## Source and hosting

- `studio.html` and `public/` contain the interface; `app/route.ts` serves the HTML.
- `public/chord-engine.js`: chord recognition, bar/section model and validated playback timelines.
- `public/document-reader.js`: browser PDF extraction and image/staff-label OCR.
- `public/library.js`: guest storage, account migration/import, file viewer and cloud library access.
- `public/practice-guide.js`: source review, plan editor, progress and audio playback.
- `public/musicxml.mjs` and `public/note-engine.js`: structured score reading, bounded MXL unpacking, note notation and suggested guitar positions.
- `public/review-engine.js` and `public/learning-tools.js`: image-marker edits, MusicXML source controls and section learning steps.
- `lib/account.ts` and `lib/library.ts`: server authentication, authorization and storage.

Passwords use salted scrypt (N=32768, r=8, p=3). Seven-day sessions use random tokens in HttpOnly, SameSite=Lax cookies, Secure on HTTPS; only token hashes are stored. Login/registration requests are rate-limited.

PDF.js/Tesseract browser assets are generated from pinned dependencies by `prebuild`. OCR downloads English recognition data from the Tesseract data CDN on first use; recognition runs in the browser. The English model targets Latin chord labels; lyrics may be inaccurate.

Sites hosting configuration lives in `.openai/hosting.json`; D1/R2 bindings are provisioned by Sites. Platform access is separate from username/password accounts and remains owner-private. Deployment applies checked-in migrations. Never commit credentials, local databases, `.env` files or generated assets.
