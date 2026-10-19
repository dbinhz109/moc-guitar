# Document library and practice review — 19 October 2026

This is the baseline review before the MusicXML and guided-learning update.
The current version also imports structured MusicXML notes/timing, offers image
label corrections and has three learning steps per section. The later
[staff-label OCR correction](ocr-staff-labels.md) fixes the supplied Nhật ký image
reference; the baseline recognition counts below are historical. See the README
for current behavior and the remaining image-recognition limits.

## Result

The application supports reviewed chord-accompaniment exercises. Uploading a
score does not automatically produce a faithful transcription or a complete
song-specific course.

## Verified behavior

- Upload/view original documents, image zoom, PDF extraction and scanned-PDF OCR.
- Candidate chord review beside the unchanged original document.
- Required meter, valid bar durations and explicit confirmation before playback.
- Explicitly chosen one-bar-per-chord simplified exercises.
- Playback, section repeats, saved progress, guest import and account-library
  synchronization between two separate browser contexts.
- Empty-result blocking, legacy-plan re-review, Vietnamese UI and mobile layout.
- Account ownership, cross-origin protection, content checks and revision conflicts
  through the existing API tests.

Practice tests: 13 passed. Library API tests: 7 passed. Account API tests: 8 passed.
The production build and TypeScript checks passed. Browser checks ran against the
local production preview; this is not a direct authenticated test of the live Site.

## Fixed during review

A section containing only `C:1 G:1` in 2/4 was incorrectly split into two
incomplete bars. This also affected reopening a saved single-bar section.

Timed lines without `|` now represent one bar; separate timed lines represent
separate bars. Untimed chord lists still require timing review. Regression tests
cover round-trip serialization, rests, incomplete durations and separate lines;
the browser upload/save/reopen scenario also passed after the fix.

## Recognition and teaching limits

- The supplied small Mưa Hồng image yielded 17 tentative chord labels. Labels were
  missing or incorrect; the meter and original durations still required review.
- The supplied Nhật ký của mẹ JPEG yielded 13 tentative labels, with substantial
  omissions and misreadings. Higher resolution alone did not make it reliable.
- Candidate counts are observations for these two files, not accuracy metrics.
- Alternative crops and OCR page-segmentation modes gave inconsistent results
  across the samples and were not included in the release.
- The system does not transcribe staff notes, melody, tablature, printed repeat
  symbols or exact original strumming. Automatically detected score sections are
  staff-line groups, not verified verse/chorus boundaries.
- A PDF is read one selected page at a time. There is no automatic multi-page
  song assembly.
- Generated guidance consists of chord diagrams/string-and-fret instructions,
  reference chord audio, timing playback and general practice steps. It is not an
  automatically composed full lesson that explains every musical detail.

For dependable beginner use, start with the built-in lessons or a clear, reviewed
chord chart. Image-derived exercises require manual comparison with the source.
