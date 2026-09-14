# SongBird Studio

Turn a hummed melody into guitar or piano, table taps into drums, and a scratch vocal into a mix-ready lead or chorus — then export MIDI or a tagged MP3. Everything runs in the browser.

**This is a separate GitHub Pages project.** It does not replace the leadership site at [wkotlewski.github.io](https://wkotlewski.github.io/).

Live: https://wkotlewski3.github.io/songbird-studio/

Repo: https://github.com/wkotlewski3/songbird-studio

## What it does

- **Melody tracks** — [pitchy](https://github.com/ianprime0509/pitchy) runs the McLeod Pitch Method (Tartini) so hummed notes keep timing, velocity, and pitch drift. MIDI plays [MusyngKite](https://github.com/gleitz/midi-js-soundfonts) GM samples (piano, guitar, bass, strings, winds, pads) with every key loaded.
- **Drum tracks** — onset detection classifies kick / snare / hats / toms / crash, then plays [Dirt-Samples](https://github.com/tidalcycles/Dirt-Samples) from TidalCycles / SuperDirt (analog synth fallback if a hit is missing).
- **Vocal tracks** — keep the recorded audio. Roles (lead, verse, chorus, double, harmony) apply compression, presence EQ, doubles, slap, and a convolution plate.
- **Tell the studio** — type `fix EQ and master, then export mp3`.
- **Export** — multi-track MIDI via `@tonejs/midi`, WAV, or 192 kbps MP3 with ID3 title / artist / album / year / genre (`lamejs`).

Audio is processed on-device. Nothing is uploaded unless you download an export.

## Honest limits

SongBird is a real transcription + sampler + mix desk, not a generative model. It will not clone a famous singer or invent a Suno-style full mix from a hum. Studio polish comes from sampled instruments, vocal treatment, and mastering — not from neural audio-to-audio.

## Local dev

```bash
npm install
npm run dev
```

## Deploy

The app is published from the `gh-pages` branch (GitHub CLI tokens often lack the `workflow` scope needed to push Actions files). Rebuild and push:

```bash
VITE_BASE=/songbird-studio/ npm run build
cp dist/index.html dist/404.html
# then publish the dist/ folder to the gh-pages branch
```

A GitHub Actions workflow lives in `docs/github-pages-workflow.yml` if you later add the `workflow` scope and move it to `.github/workflows/deploy.yml`.
