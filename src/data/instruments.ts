export type InstrumentGroup = 'keys' | 'guitar' | 'bass' | 'strings' | 'winds' | 'synth' | 'drums' | 'voice'

export interface Instrument {
  id: string
  label: string
  group: InstrumentGroup
  /** MIDI.js soundfont name, or 'dirt' / 'analog' for drum sample maps and the analog synth */
  soundfont: string
  program: number
  kind: 'melody' | 'drums' | 'vocals'
  blurb: string
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'piano', label: 'Concert piano', group: 'keys', soundfont: 'acoustic_grand_piano', program: 0, kind: 'melody', blurb: 'MusyngKite GM grand — full samples, not a thinned set.' },
  { id: 'bright-piano', label: 'Bright piano', group: 'keys', soundfont: 'bright_acoustic_piano', program: 1, kind: 'melody', blurb: 'More attack and treble for pop sketches.' },
  { id: 'rhodes', label: 'Rhodes', group: 'keys', soundfont: 'electric_piano_1', program: 4, kind: 'melody', blurb: 'Warm electric piano for verses and late-night feels.' },
  { id: 'wurly', label: 'Wurlitzer', group: 'keys', soundfont: 'electric_piano_2', program: 5, kind: 'melody', blurb: 'Barkier keys for indie and soul.' },
  { id: 'nylon', label: 'Nylon guitar', group: 'guitar', soundfont: 'acoustic_guitar_nylon', program: 24, kind: 'melody', blurb: 'Soft fingerstyle — closest to a gentle hum.' },
  { id: 'steel', label: 'Steel guitar', group: 'guitar', soundfont: 'acoustic_guitar_steel', program: 25, kind: 'melody', blurb: 'Folk and singer-songwriter sparkle.' },
  { id: 'jazz-gtr', label: 'Jazz guitar', group: 'guitar', soundfont: 'electric_guitar_jazz', program: 26, kind: 'melody', blurb: 'Hollow-body warmth for mellow lines.' },
  { id: 'clean-gtr', label: 'Clean electric', group: 'guitar', soundfont: 'electric_guitar_clean', program: 27, kind: 'melody', blurb: 'Studio clean tone for hooks.' },
  { id: 'muted-gtr', label: 'Muted guitar', group: 'guitar', soundfont: 'electric_guitar_muted', program: 28, kind: 'melody', blurb: 'Palm-muted chug for rhythmic hums.' },
  { id: 'overdrive', label: 'Overdrive guitar', group: 'guitar', soundfont: 'overdriven_guitar', program: 29, kind: 'melody', blurb: 'Crunch for choruses you hummed louder.' },
  { id: 'acoustic-bass', label: 'Upright bass', group: 'bass', soundfont: 'acoustic_bass', program: 32, kind: 'melody', blurb: 'Woody low end for jazz and folk.' },
  { id: 'finger-bass', label: 'Finger bass', group: 'bass', soundfont: 'electric_bass_finger', program: 33, kind: 'melody', blurb: 'Classic electric bass, fingered.' },
  { id: 'fretless', label: 'Fretless bass', group: 'bass', soundfont: 'fretless_bass', program: 35, kind: 'melody', blurb: 'Sliding low end for lyrical bass lines.' },
  { id: 'violin', label: 'Violin', group: 'strings', soundfont: 'violin', program: 40, kind: 'melody', blurb: 'Expressive lead for lyrical hums.' },
  { id: 'cello', label: 'Cello', group: 'strings', soundfont: 'cello', program: 42, kind: 'melody', blurb: 'Close to the range of a low hum.' },
  { id: 'pizz', label: 'Pizzicato strings', group: 'strings', soundfont: 'pizzicato_strings', program: 45, kind: 'melody', blurb: 'Plucked ensemble for staccato phrases.' },
  { id: 'ensemble', label: 'String ensemble', group: 'strings', soundfont: 'string_ensemble_1', program: 48, kind: 'melody', blurb: 'Cinematic pad from a hummed contour.' },
  { id: 'flute', label: 'Flute', group: 'winds', soundfont: 'flute', program: 73, kind: 'melody', blurb: 'Airy, close to whistling and light humming.' },
  { id: 'harmonica', label: 'Harmonica', group: 'winds', soundfont: 'harmonica', program: 22, kind: 'melody', blurb: 'Close to a sung vowel — great for folk hooks.' },
  { id: 'tenor-sax', label: 'Tenor sax', group: 'winds', soundfont: 'tenor_sax', program: 66, kind: 'melody', blurb: 'Breath and bite — good for soulful lines.' },
  { id: 'trumpet', label: 'Trumpet', group: 'winds', soundfont: 'trumpet', program: 56, kind: 'melody', blurb: 'Bright fanfare for stronger phrases.' },
  { id: 'muted-tpt', label: 'Muted trumpet', group: 'winds', soundfont: 'muted_trumpet', program: 59, kind: 'melody', blurb: 'Softer brass for intimate lines.' },
  { id: 'warm-pad', label: 'Warm pad', group: 'synth', soundfont: 'pad_2_warm', program: 89, kind: 'melody', blurb: 'Slow synth bed that follows your melody.' },
  { id: 'choir', label: 'Choir aahs', group: 'synth', soundfont: 'choir_aahs', program: 52, kind: 'melody', blurb: 'Open GM choir vowels for hummed pads.' },
  { id: 'oohs', label: 'Voice oohs', group: 'synth', soundfont: 'voice_oohs', program: 53, kind: 'melody', blurb: 'Softer choir vowels for stacked hums.' },
  {
    id: 'songbird-kit',
    label: 'Tidal acoustic',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Classic SuperDirt hits — then swap any piece for another open sample.',
  },
  {
    id: 'drum-808',
    label: '808',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Roland-style 808 kick, snare, hats, and toms from Dirt-Samples.',
  },
  {
    id: 'drum-house',
    label: 'House',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Four-on-the-floor kick, house snare, real claps, and open hats.',
  },
  {
    id: 'drum-electro',
    label: 'Electro',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Sharp electro kicks and snares with a machine clap.',
  },
  {
    id: 'drum-gretsch',
    label: 'Gretsch / jazz',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Acoustic kit and brushes — jazz, folk, and roomy taps.',
  },
  {
    id: 'drum-sequential',
    label: 'Sequential',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Tom / Sequential Circuits machine — clap, kick, hats, crash.',
  },
  {
    id: 'drum-dr55',
    label: 'DR-55',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Boss DR-55 analog box: kick, snare, rim, hat.',
  },
  {
    id: 'drum-claps',
    label: 'Clap rack',
    group: 'drums',
    soundfont: 'dirt',
    program: 0,
    kind: 'drums',
    blurb: 'Hand claps up front — for the take you actually clapped.',
  },
  {
    id: 'drum-analog',
    label: 'Analog synth',
    group: 'drums',
    soundfont: 'analog',
    program: 0,
    kind: 'drums',
    blurb: 'On-device analog-style hits when you want no sample library.',
  },
  {
    id: 'gm-kit',
    label: 'Studio GM kit',
    group: 'drums',
    soundfont: 'synth_drum',
    program: 118,
    kind: 'drums',
    blurb: 'General MIDI percussion from the MusyngKite soundfont.',
  },
  { id: 'vocal-lead', label: 'Studio lead', group: 'voice', soundfont: 'vocal', program: 0, kind: 'vocals', blurb: 'Crisp, de-essed, tight room — the front of a record.' },
  { id: 'vocal-verse', label: 'Warm verse', group: 'voice', soundfont: 'vocal', program: 0, kind: 'vocals', blurb: 'Closer and drier so the lyric sits.' },
  { id: 'vocal-chorus', label: 'Chorus stack', group: 'voice', soundfont: 'vocal', program: 0, kind: 'vocals', blurb: 'Wider doubles, air, and hall for the lift.' },
  { id: 'vocal-echo', label: 'Echo vocal', group: 'voice', soundfont: 'vocal', program: 0, kind: 'vocals', blurb: 'Studio tone with 1/8 repeats timed to the click.' },
  { id: 'vocal-ambient', label: 'Ambient vocal', group: 'voice', soundfont: 'vocal', program: 0, kind: 'vocals', blurb: 'Cathedral space and a soft slap behind the line.' },
]

export const SOUNDFONT_BASE =
  'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/MusyngKite'

export const SOUNDFONT_CREDIT =
  'Open tools: pitchy (McLeod / Tartini pitch), MusyngKite GM via midi-js-soundfonts, Dirt-Samples drums (TidalCycles — individual hits, not just kits), Tone MIDI + lamejs for export. Everything runs on-device.'

export function instrumentById(id: string): Instrument {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]
}

export function instrumentsFor(kind: Instrument['kind']): Instrument[] {
  return INSTRUMENTS.filter((i) => i.kind === kind)
}

export const DEFAULT_INSTRUMENT: Record<Instrument['kind'], string> = {
  melody: 'steel',
  drums: 'songbird-kit',
  vocals: 'vocal-lead',
}
