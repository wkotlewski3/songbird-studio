const TOOLS: { name: string; href: string; role: string }[] = [
  {
    name: 'pitchy',
    href: 'https://github.com/ianprime0509/pitchy',
    role: 'McLeod / Tartini pitch tracker — reads hummed melody into notes, on-device.',
  },
  {
    name: 'MusyngKite GM',
    href: 'https://github.com/gleitz/midi-js-soundfonts',
    role: 'Open General MIDI samples (piano, guitar, bass, strings, winds, pads) via midi-js-soundfonts.',
  },
  {
    name: 'Dirt-Samples',
    href: 'https://github.com/tidalcycles/Dirt-Samples',
    role: 'TidalCycles / SuperDirt library — individual kicks, snares, claps, hats, toms across acoustic, 808, house, electro, jazz, and analog boxes.',
  },
  {
    name: '@tonejs/midi',
    href: 'https://github.com/Tonejs/Midi',
    role: 'Writes a multi-track MIDI file from the session.',
  },
  {
    name: 'lamejs',
    href: 'https://github.com/zhuker/lamejs',
    role: 'Encodes the bounced mix as an MP3 with ID3 tags.',
  },
  {
    name: 'React + Vite + Tailwind',
    href: 'https://github.com/wkotlewski3/songbird-studio',
    role: 'The studio UI itself. Source is on GitHub.',
  },
]

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Set the grid',
    body: 'Pick a BPM. Press Play — you should hear a click on a 4-bar loop. Mute Click anytime, including after a take you recorded with the metronome or count-in. The click is only in your speakers; it is never in the recording or the export.',
  },
  {
    title: 'Loop a region',
    body: 'Use 1 / 2 / 4 / 8 bar, or drag on the timeline. Click to jump. Drag the gold edges to resize. Loop stays on so you can build in place.',
  },
  {
    title: 'Add a track — or skip it',
    body: 'Melody for hums, drums for taps, vocals for singing. Or just record / drop a raw file: SongBird classifies the take and opens the right track.',
  },
  {
    title: 'Record live or drop a raw file',
    body: 'Record live captures the next pass. Mute Click anytime — including before you record. The metronome is never in the take or the export.',
  },
  {
    title: 'Clean and mix',
    body: 'Takes lock to the click by default, even if you recorded without it. SongBird stretches the pulse onto this BPM and puts beat 1 on the downbeat, without flattening extra off-beats (syncopation, 12/8, added hits). Snap to click in the inspector is how hard notes hug the grid. Melody layers voice as chords (triads, 7ths, power, pad) in the session key — switch to Solo for a single line. A second layer stays on that same loop — Make layers in sync if two takes still drift. Lengthen 4 bars to 16 and the phrase repeats. Vocals get lead, verse, chorus, double, or harmony.',
  },
  {
    title: 'Save the sketch',
    body: 'Sessions autosave in this browser — takes, MIDI, mix, and loop — so you can close the tab without exporting. Save writes now. Sessions lists other sketches. Save copy to disk writes a .songbird file you can open later.',
  },
  {
    title: 'Export',
    body: 'MP3 (tagged), WAV, or MIDI. The click is never in the bounce. Nothing is uploaded unless you download a file.',
  },
]

export function About({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 py-10"
      onClick={onClose}
      role="presentation"
    >
      <article
        className="w-full max-w-2xl rounded-3xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="about-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold">SongBird Studio</p>
            <h2 id="about-title" className="font-display text-3xl text-white">
              About this app
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-sm text-mute hover:border-gold hover:text-gold"
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-mist">
          SongBird is a browser studio for turning a hummed line into guitar or piano, table taps into drums, and a
          scratch vocal into a treated lead — then exporting MIDI or a tagged MP3. It is a transcription + sampler +
          mix desk, not a generative model. It will not clone a singer or invent a full Suno-style arrangement.
        </p>

        <h3 className="mt-8 font-display text-xl text-white">How to use it</h3>
        <ol className="mt-3 flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-ink/50 p-4">
              <p className="text-xs uppercase tracking-widest text-gold">
                {i + 1}. {step.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-mute">{step.body}</p>
            </li>
          ))}
        </ol>

        <h3 className="mt-8 font-display text-xl text-white">Open-source tools</h3>
        <p className="mt-2 text-sm text-mute">
          Audio is processed on this machine. Instruments and analysis come from these projects:
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {TOOLS.map((tool) => (
            <li key={tool.name} className="rounded-2xl border border-line/80 px-4 py-3">
              <a
                href={tool.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-gold hover:underline"
              >
                {tool.name}
              </a>
              <p className="mt-1 text-sm text-mute">{tool.role}</p>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-mute">
          This site is separate from the portfolio at{' '}
          <a href="https://wkotlewski.github.io/" className="text-mist hover:text-gold" target="_blank" rel="noreferrer">
            wkotlewski.github.io
          </a>
          . Source:{' '}
          <a
            href="https://github.com/wkotlewski3/songbird-studio"
            className="text-mist hover:text-gold"
            target="_blank"
            rel="noreferrer"
          >
            github.com/wkotlewski3/songbird-studio
          </a>
          .
        </p>
      </article>
    </div>
  )
}
