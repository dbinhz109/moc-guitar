# Mộc Guitar Studio

A buildless beginner guitar learning app, English by default with Vietnamese localization.

## Run locally

```sh
python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173. No installation or build needed.

## Features

- Three guided lessons with chord diagrams and practice progress.
- Six-chord reference and two built-in reading resources.
- Web Audio metronome, 40–180 BPM, four beats per bar.
- PDF, PNG/JPEG/WebP and TXT/Markdown uploads (10 MB per file), reading and deletion.
- Language preference and progress in localStorage; documents in IndexedDB.
- Responsive keyboard-accessible interface.

Uploads stay in the current browser; clearing site data removes them. No account synchronization or automatic lesson generation from uploads. The first two practice compositions are original exercises; the third uses a traditional melody with simplified accompaniment. No microphone scoring or live instructor.
