import type { Layer, TrackKind, TranscribeSettings } from '../types'
import { hitsFromAnalysis } from './drums'
import { getLayerAnalysis, getLayerBuffer } from './engine'
import { alignMidiToTempo, phraseLength } from './grid'
import { notesFromAnalysis } from './melody'

export function revoiceLayer(
  layer: Layer,
  kind: TrackKind,
  transcribe: TranscribeSettings,
  bpm = 92,
): Partial<Layer> {
  const analysis = getLayerAnalysis(layer.id)
  const loopLen = phraseLength(layer.duration, bpm)
  if (kind === 'melody' && analysis?.kind === 'melody') {
    const { notes } = notesFromAnalysis(analysis.melody, transcribe)
    const aligned = alignMidiToTempo(notes, [], bpm, loopLen)
    return {
      transcribe,
      notes: aligned.notes,
      drums: [],
      status: `${aligned.notes.length} note${aligned.notes.length === 1 ? '' : 's'} from this take`,
    }
  }
  if (kind === 'drums' && analysis?.kind === 'drums') {
    const buffer = getLayerBuffer(layer.id)
    if (!buffer) return { transcribe }
    const drums = hitsFromAnalysis(buffer, analysis.drums, transcribe)
    const aligned = alignMidiToTempo([], drums, bpm, loopLen)
    return {
      transcribe,
      drums: aligned.drums,
      notes: [],
      status: `${aligned.drums.length} hit${aligned.drums.length === 1 ? '' : 's'} from this take`,
    }
  }
  return { transcribe }
}
