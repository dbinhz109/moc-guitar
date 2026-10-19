# TAB notes — 19 October 2026

The supplied Lágrima score has four five-line notation staves and four six-line
TAB staves. The previous reader assigned Section 1–8 to all eight detected bands.
It read note/stem ink above the TAB as letters and returned F under Section 4,
F F F under Section 6 and F under Section 8. These were neither measure numbers
nor an analysis of the piece's harmony.

The correction distinguishes six-line TAB before chord-label OCR. Fret symbols
are associated with a string, then converted to sounding pitches in standard
tuning. Neighboring horizontal positions are tentative simultaneous groups. The
original written string/fret positions travel with the note events through the
editor, playback, local storage and account sync. The server rejects impossible
frets, duplicate strings in one group, and mismatched TAB/pitch data.

The review grid exposes unresolved symbols instead of dropping them. Every `?`
must be corrected or removed before a derived plan is created. A learner can edit
a pair/group, insert or remove groups, preview pitches, and enter local bar
numbers and counts. Bar numbering is local to each TAB line and must start at 1
and progress consecutively; a section is not a measure. Plain ASCII six-line TAB
and manually entered pitch plans are also accepted.

## Validation scope

- The original supplied image reproduces the old false-F output. The new reader
  identifies four notation staves plus four TAB staves, emits no chord names,
  retains many uncertain symbols, and blocks an incomplete plan. There is no
  verified full note transcription for this image and no claim of note accuracy
  based on OCR confidence alone. Detected ink regions are not a count of musical
  notes. The source image is not distributed in the repository.
- An original clear raster fixture reads all six authored string/fret positions,
  including a simultaneous pair, open strings and fret 12. This verifies the
  actual image/OCR/editor path, not just a parser supplied with known tokens.
- The ASCII example and editor verify preservation of string/fret positions,
  simultaneous sounding pitches, explicitly entered bars/durations, saved plans,
  synthesized playback, review gating, Vietnamese strings and mobile layout.
- Unit checks cover whole-plan blocking when any fret is unknown, standard-tuning
  pitch conversion, unison-capable positions on different strings, serialization
  and rejection of impossible or inconsistent positions. Account API checks
  verify saved TAB data and rejection of invalid data.
- Existing chord-label OCR and MusicXML checks remain necessary: TAB recognition
  is a separate path and must not replace genuine printed chord labels.

## Limits

Only upright, regular, printed six-string TAB in standard tuning and frets 0–24
is interpreted. No harmony, meter, original timing or musical rests are invented.
ASCII technique marks are reported without interpretation. Articulation, ties,
overlapping voices, fret-hand fingering, capo, alternate tunings and graphical
repeats/endings need manual review. Group playback does not reproduce a complete
polyphonic score. Five-line staff-note OCR remains unavailable; MusicXML supports
written pitches and timing, and a note plan can be entered manually.

The previous test compared chord labels only and had no negative case for a score
without printed chord names. The new score-plus-TAB regression prevents that
classification error, while a separate authored raster fixture tests fret OCR.
