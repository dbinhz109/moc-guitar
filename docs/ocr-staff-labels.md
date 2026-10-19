# Staff-label OCR correction — 19 October 2026

## Reproduction and cause

The supplied Nhật ký của mẹ image produced 13 candidate chord labels instead of
the 30 labels reviewed by the user. The second staff system disappeared from the
plan. Whole-row OCR combined chord text with clef/stem ink, assumed one text
baseline despite varying label heights, and cut a fixed percentage from the left
margin. Examples included an incorrect B and missing Em/F labels.

## Correction

For sufficiently resolved staff systems, isolate text-sized connected ink regions
across the full width above the staff. Group neighboring glyphs into labels, crop
them independently, normalize character size/background, and reject outputs that
are not complete chord tokens. Uncertain reads get bounded alternative crops;
the user's reference is used only in tests, never in the recognition algorithm.

Reading a staff establishes candidate label order, not barlines or duration.
Unmeasured sequences no longer serialize one bar separator per chord. Multiple
chords within a verified bar remain supported. Selecting 3/4 does not populate
durations. Per-chord full-bar timing requires the existing explicit simplified
exercise choice.

Old saved plans are retained and offer Read again; recognition does not silently
overwrite user corrections. A staff with no recognized labels is now reported.

## Verification

- Actual UI import of the supplied 2481×3509 image: all 30 labels matched all five
  user-reviewed staff sequences, including repeated consecutive Am labels.
- A separately resized/re-encoded 1600-pixel-wide version also matched 30/30.
- Both cases retained unknown durations and blocked playback after selecting 3/4
  and confirming review, until an explicitly timed example was entered.
- An explicitly entered 3/4 example kept two chords in the same bar. This example
  is not a duration transcription of the supplied song.
- The small 376×531 Mưa Hồng image retained its previous 17 tentative labels and
  low-resolution warning; it is still incomplete and requires manual correction.

The optional real-image regression is `tests/score-recognition.cjs`, with the
user-reviewed label-only reference in `tests/fixtures/nhat-ky-reference.json`.
The score image itself is not distributed in the repository.

## Prevention and remaining limits

Earlier browser checks verified that some chords were present and that a practice
plan could be made, without comparing the complete sequence to a reviewed source.
The new test asserts every label, staff grouping, order, and unknown-duration gate.
These two matching image variants do not establish accuracy across other scores.
Staff notes, original rhythm, melody and original strumming are not transcribed
from an image; durations in the supplied reference have not been verified.

## Follow-up: score plus TAB

The later Lágrima report exposed a different failure: six-line TAB was being
counted alongside five-line notation, and note ink was read as F chord labels.
The TAB reader now routes this layout to reviewed string/fret notes instead.
See [TAB notes](tab-notes.md) for reproduction, tests and remaining limits.
