import { BirdMark } from './BirdMark'
import type { TrackKind } from '../types'

const CARDS: { kind: TrackKind; title: string; body: string; cue: string }[] = [
  {
    kind: 'melody',
    title: 'Hum it',
    body: 'A hummed line is read with the open McLeod pitch tracker, then voiced on MusyngKite GM guitar, piano, strings, and more.',
    cue: 'Melody → MIDI',
  },
  {
    kind: 'drums',
    title: 'Hit it',
    body: 'Table taps and claps become MIDI hits, voiced on open Dirt-Samples — individual kicks, snares, claps, hats, not just three kits.',
    cue: 'Hits → kit',
  },
  {
    kind: 'vocals',
    title: 'Sing it',
    body: 'Lead, verse, or chorus treatments — presence, doubles, plate — so a scratch vocal sits like a record, not a demo.',
    cue: 'Take → mix',
  },
]

export function Landing({
  onStart,
  onContinue,
  onAbout,
  resume,
}: {
  onStart: (kind?: TrackKind, fresh?: boolean) => void
  onContinue: () => void
  onAbout: () => void
  resume: { title: string; savedAt: number | null; bpm: number } | null
}) {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BirdMark />
          <div>
            <p className="font-display text-lg text-gold">SongBird Studio</p>
            <p className="text-xs text-mute">Open-source pitch, samples, and mix</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAbout}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold hover:text-gold"
          >
            About
          </button>
          <button
            onClick={() => onStart(undefined, Boolean(resume))}
            className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold hover:text-gold"
          >
            {resume ? 'New sketch' : 'Open studio'}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-12 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm uppercase tracking-[0.22em] text-gold-2">From sketch to master</p>
          <h1 className="font-display text-5xl leading-[1.05] text-white sm:text-7xl">
            Hum a guitar.
            <br />
            Tap a kit.
            <br />
            Walk out with a record.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-mute">
            Record live or drop a raw take. SongBird hears melody, vocal, or beat, puts it on the metronome,
            and cleans the ends so it loops — then you layer guitar, kit, and mix. Sketches save in this browser
            even if you never export.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {resume && (
              <button
                onClick={onContinue}
                className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-ink hover:bg-gold-2"
              >
                Continue {resume.title}
                <span className="mt-1 block text-[11px] font-normal opacity-80">{resume.bpm} BPM</span>
              </button>
            )}
            <button
              onClick={() => onStart('melody', true)}
              className={
                resume
                  ? 'rounded-full border border-line px-6 py-3 text-sm text-mist hover:border-gold'
                  : 'rounded-full bg-gold px-6 py-3 text-sm font-medium text-ink hover:bg-gold-2'
              }
            >
              Start a session
            </button>
            <button
              onClick={() => onStart(undefined, true)}
              className="rounded-full border border-line px-6 py-3 text-sm text-mist hover:border-gold"
            >
              Empty studio
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map((c) => (
            <button
              key={c.kind}
              onClick={() => onStart(c.kind, true)}
              className="rounded-3xl border border-line bg-panel p-6 text-left transition hover:border-gold/50"
            >
              <p className="text-xs uppercase tracking-widest text-mute">{c.cue}</p>
              <h2 className="mt-3 font-display text-3xl text-white">{c.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-mute">{c.body}</p>
            </button>
          ))}
        </div>
      </main>

      <footer className="border-t border-line pt-6 text-xs text-mute">
        <button type="button" onClick={onAbout} className="hover:text-gold">
          About the app
        </button>
        {' · '}
        Runs in your browser on open-source tools. Sketches autosave on this machine. Audio never leaves unless you
        export or download a copy. Separate from the portfolio site at wkotlewski.github.io.
      </footer>
    </div>
  )
}
