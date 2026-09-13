import { BirdMark } from './BirdMark'
import type { TrackKind } from '../types'

const CARDS: { kind: TrackKind; title: string; body: string; cue: string }[] = [
  {
    kind: 'melody',
    title: 'Hum it',
    body: 'A hummed line becomes guitar, piano, strings, or whatever open-source instrument you pick. Timing and velocity stay yours.',
    cue: 'Melody → MIDI',
  },
  {
    kind: 'drums',
    title: 'Hit it',
    body: 'Table taps, body percussion, or a phone recording of a groove. We map kicks, snares, and hats without flattening the feel.',
    cue: 'Hits → kit',
  },
  {
    kind: 'vocals',
    title: 'Sing it',
    body: 'Lead, verse, or chorus treatments — presence, doubles, plate — so a scratch vocal sits like a record, not a demo.',
    cue: 'Take → mix',
  },
]

export function Landing({ onStart }: { onStart: (kind?: TrackKind) => void }) {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BirdMark />
          <div>
            <p className="font-display text-lg text-gold">SongBird Studio</p>
            <p className="text-xs text-mute">On-device transcription · open sounds</p>
          </div>
        </div>
        <button
          onClick={() => onStart()}
          className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold hover:text-gold"
        >
          Open studio
        </button>
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
            SongBird turns performance into MIDI and a mixable session — then lets you tell it to
            fix EQ, master, and export an MP3 with the right title and artist.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => onStart('melody')}
              className="rounded-full bg-gold px-6 py-3 text-sm font-medium text-ink hover:bg-gold-2"
            >
              Start a session
            </button>
            <button
              onClick={() => onStart()}
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
              onClick={() => onStart(c.kind)}
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
        Runs in your browser. Audio never leaves this machine unless you export. Separate from the
        portfolio site at wkotlewski.github.io.
      </footer>
    </div>
  )
}
