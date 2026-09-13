# SongBird Studio

Turn a hummed melody into guitar or piano, table taps into drums, and a scratch vocal into a mix-ready lead or chorus — then export MIDI or a tagged MP3. Everything runs in the browser.

**This is a separate GitHub Pages project.** It does not replace the leadership site at [wkotlewski.github.io](https://wkotlewski.github.io/).

Live (after Pages is enabled): https://wkotlewski.github.io/songbird-studio/

## What it does

- **Melody tracks** — YIN pitch tracking keeps timing, velocity, and pitch drift so the take still feels like you. Map the MIDI to open GM soundfonts (piano, nylon/steel guitar, bass, strings, winds, pads).
- **Drum tracks** — onset detection classifies kick / snare / hats / toms / crash. Play the built-in analog-style **SongBird kit** or a GM kit.
- **Vocal tracks** — keep the recorded audio. Roles (lead, verse, chorus, double, harmony) apply compression, presence EQ, doubles, slap, and plate.
- **Tell the studio** — type `fix EQ and master, then export mp3`.
- **Export** — multi-track MIDI, WAV, or 192 kbps MP3 with ID3 title / artist / album / year / genre.

Audio is processed on-device. Nothing is uploaded unless you download an export.

## Honest limits

SongBird is a real transcription + sampler + mix desk, not a generative model. It will not clone a famous singer or invent a Suno-style full mix from a hum. Studio polish comes from sampled instruments, vocal treatment, and mastering — not from neural audio-to-audio.

## Local dev

```bash
npm install
npm run dev
```

## Deploy

GitHub Actions builds on push to `main` with `VITE_BASE=/songbird-studio/`. Enable **Settings → Pages → Source: GitHub Actions**.
