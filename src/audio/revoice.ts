import type { Layer, TrackKind, TranscribeSettings } from '../types'
import { hitsFromAnalysis } from './drums'
import { getLayerAnalysis, getLayerBuffer } from './engine'
import { notesFromAnalysis } from './melody'

export function revoiceLayer(
  layer: Layer,
  kind: TrackKind,
  transcribe: TranscribeSettings,
): Partial<Layer> {
  const analysis = getLayerAnalysis(layer.id)
  if (kind === 'melody' && analysis?.kind === 'melody') {
    const { notes } = notesFromAnalysis(analysis.melody, transcribe)
    return {
      transcribe,
      notes,
      drums: [],
      status: `${notes.length} note${notes.length === 1 ? '' : 's'} from this take`,
    }
  }
  if (kind === 'drums' && analysis?.kind === 'drums') {
    const buffer = getLayerBuffer(layer.id)
    if (!buffer) return { transcribe }
    const drums = hitsFromAnalysis(buffer, analysis.drums, transcribe)
    return {
      transcribe,
      drums,
      notes: [],
      status: `${drums.length} hit${drums.length === 1 ? '' : 's'} from this take`,
    }
  }
  return { transcribe }
}
