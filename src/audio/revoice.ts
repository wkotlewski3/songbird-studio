import type { Layer, TrackKind, TranscribeSettings } from '../types'
import { defaultRhythm } from '../types'
import { hitsFromAnalysis, quantizeDrums } from './drums'
import { getLayerAnalysis, getLayerBuffer } from './engine'
import { alignMidiToTempo, phraseLength } from './grid'
import { notesFromAnalysis, quantizeNotes } from './melody'

export function revoiceLayer(
  layer: Layer,
  kind: TrackKind,
  transcribe: TranscribeSettings,
  bpm = 92,
): Partial<Layer> {
  const analysis = getLayerAnalysis(layer.id)
  const feel = layer.rhythm ?? defaultRhythm()
  const loopLen = phraseLength(layer.duration, bpm)
  const amount = layer.quantize
  if (kind === 'melody' && analysis?.kind === 'melody') {
    const { notes } = notesFromAnalysis(analysis.melody, transcribe)
    const aligned = alignMidiToTempo(notes, [], bpm, loopLen, feel)
    return {
      transcribe,
      notes: quantizeNotes(aligned.notes, bpm, amount, feel.slotsPerBeat),
      drums: [],
      rhythm: feel,
      status: `${aligned.notes.length} note${aligned.notes.length === 1 ? '' : 's'} · ${feel.label}`,
    }
  }
  if (kind === 'drums' && analysis?.kind === 'drums') {
    const buffer = getLayerBuffer(layer.id)
    if (!buffer) return { transcribe }
    const drums = hitsFromAnalysis(buffer, analysis.drums, transcribe)
    const aligned = alignMidiToTempo([], drums, bpm, loopLen, feel)
    return {
      transcribe,
      drums: quantizeDrums(aligned.drums, bpm, amount, feel.slotsPerBeat),
      notes: [],
      rhythm: feel,
      status: `${aligned.drums.length} hit${aligned.drums.length === 1 ? '' : 's'} · ${feel.label}`,
    }
  }
  return { transcribe }
}
