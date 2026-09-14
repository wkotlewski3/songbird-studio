import type { Layer, MelodyVoicing, MidiNote } from '../types'
import { layerSlotsPerBeat } from './grid'
import { quantizeNotes } from './melody'

export const MELODY_VOICINGS: { id: MelodyVoicing; label: string; hint: string }[] = [
  { id: 'solo', label: 'Solo', hint: 'Just the hummed line' },
  { id: 'octaves', label: 'Octaves', hint: 'Line doubled down an octave' },
  { id: 'thirds', label: 'Thirds', hint: 'Diatonic 3rds under the line' },
  { id: 'power', label: 'Power', hint: 'Root and fifth — guitar punch' },
  { id: 'triads', label: 'Triads', hint: 'Full chords from the hummed pitch' },
  { id: 'sevenths', label: '7ths', hint: 'Richer four-note chords' },
  { id: 'pad', label: 'Pad', hint: 'Held chords that change when the harmony moves' },
]

export const SESSION_KEYS = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Am',
  'Em',
  'Bm',
  'F#m',
  'C#m',
  'Dm',
  'Gm',
  'Cm',
]

const PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  DB: 1,
  D: 2,
  'D#': 3,
  EB: 3,
  E: 4,
  F: 5,
  'F#': 6,
  GB: 6,
  G: 7,
  'G#': 8,
  AB: 8,
  A: 9,
  'A#': 10,
  BB: 10,
  B: 11,
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]

export function parseKey(raw: string): { tonic: number; minor: boolean } {
  const s = raw.trim().replace(/\s+/g, '')
  const minor = /(m|min|minor)$/i.test(s) && !/^maj/i.test(s)
  const letter = s.replace(/(major|maj|minor|min|m)$/i, '')
  const tonic = PC[letter.toUpperCase()] ?? 0
  return { tonic, minor }
}

function scalePcs(tonic: number, minor: boolean): number[] {
  return (minor ? MINOR : MAJOR).map((step) => (step + tonic) % 12)
}

function nearestDegree(pc: number, scale: number[]): number {
  let best = 0
  let bestDist = 12
  for (let i = 0; i < scale.length; i++) {
    const d = Math.min((pc - scale[i] + 12) % 12, (scale[i] - pc + 12) % 12)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

function chordPcs(degree: number, scale: number[], seventh: boolean): number[] {
  const tone = (steps: number) => scale[(degree + steps) % 7]
  const pcs = [tone(0), tone(2), tone(4)]
  if (seventh) pcs.push(tone(6))
  return pcs
}

function below(pc: number, top: number): number {
  let m = top - ((((top % 12) + 12) % 12 - pc + 12) % 12)
  if (m > top) m -= 12
  if (m === top) m -= 12
  return m
}

function inBand(midi: number, low = 36, high = 84): number {
  let m = midi
  while (m < low) m += 12
  while (m > high) m -= 12
  return m
}

function uniqueMidi(values: number[]): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const v of values) {
    const m = Math.round(inBand(v))
    if (seen.has(m)) continue
    seen.add(m)
    out.push(m)
  }
  return out.sort((a, b) => a - b)
}

function stack(melody: MidiNote, midis: number[], lead = true): MidiNote[] {
  const tones = uniqueMidi(lead ? [melody.midi, ...midis] : midis)
  return tones.map((midi) => ({
    ...melody,
    midi,
    cents: midi === melody.midi ? melody.cents : 0,
    velocity: midi === melody.midi ? melody.velocity : Math.round(melody.velocity * 0.7),
  }))
}

export function voiceMelody(notes: MidiNote[], voicing: MelodyVoicing, key: string): MidiNote[] {
  if (voicing === 'solo' || !notes.length) return notes
  const { tonic, minor } = parseKey(key)
  const scale = scalePcs(tonic, minor)

  if (voicing === 'pad') {
    const out: MidiNote[] = []
    let i = 0
    while (i < notes.length) {
      const deg = nearestDegree(((notes[i].midi % 12) + 12) % 12, scale)
      let end = notes[i].time + notes[i].duration
      let j = i
      while (j + 1 < notes.length) {
        const nextDeg = nearestDegree(((notes[j + 1].midi % 12) + 12) % 12, scale)
        if (nextDeg !== deg) break
        j++
        end = Math.max(end, notes[j].time + notes[j].duration)
      }
      const held = { ...notes[i], duration: Math.max(notes[i].duration, end - notes[i].time) }
      out.push(...voiceOne(held, 'triads', scale))
      i = j + 1
    }
    return out
  }

  return notes.flatMap((note) => voiceOne(note, voicing, scale))
}

function voiceOne(note: MidiNote, voicing: MelodyVoicing, scale: number[]): MidiNote[] {
  const pc = ((note.midi % 12) + 12) % 12
  const deg = nearestDegree(pc, scale)
  const root = scale[deg]

  if (voicing === 'octaves') return stack(note, [note.midi - 12])
  if (voicing === 'thirds') return stack(note, [below(scale[(deg + 2) % 7], note.midi)])
  if (voicing === 'power') {
    const fifth = (root + 7) % 12
    const bass = inBand(below(root, 52), 36, 55)
    return stack(note, [bass, below(fifth, note.midi)])
  }

  const seventh = voicing === 'sevenths'
  const pcs = chordPcs(deg, scale, seventh)
  const bass = inBand(below(pcs[0], 50), 36, 55)
  const inner = pcs.slice(1).map((p) => below(p, note.midi))
  return stack(note, [bass, ...inner])
}

/** Quantize then expand into the chosen voicing for playback, piano roll, and export. */
export function realizedNotes(layer: Pick<Layer, 'notes' | 'quantize' | 'rhythm' | 'voicing'>, bpm: number, key: string): MidiNote[] {
  const quantized = quantizeNotes(layer.notes, bpm, layer.quantize, layerSlotsPerBeat(layer))
  return voiceMelody(quantized, layer.voicing ?? 'triads', key)
}
