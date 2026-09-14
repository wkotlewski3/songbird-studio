import { useMemo } from 'react'
import type { DrumHit, MelodyVoicing, MidiNote } from '../types'
import { layerPlaybackPhrase, tileEvents, wrapTime } from '../audio/grid'
import { voiceMelody } from '../audio/voicing'

const LAYER_COLORS = ['#7dcea0', '#e8b86d', '#9b8ec4', '#e07a5f', '#8ecae6']

export function PianoRoll({
  layers,
  duration,
  playhead,
  bpm = 92,
  bars = 4,
  songKey = 'C',
}: {
  layers: { id: string; notes: MidiNote[]; drums: DrumHit[]; duration?: number; voicing?: MelodyVoicing }[]
  duration: number
  playhead: number
  bpm?: number
  bars?: number
  songKey?: string
}) {
  const width = 720
  const height = 180
  const t = Math.max(duration, 1.2)
  const allNotes = useMemo(
    () => layers.flatMap((l) => voiceMelody(l.notes, l.voicing ?? 'triads', songKey)),
    [layers, songKey],
  )

  const { minM, maxM } = useMemo(() => {
    if (!allNotes.length) return { minM: 48, maxM: 72 }
    const ms = allNotes.map((n) => n.midi)
    return { minM: Math.min(...ms) - 2, maxM: Math.max(...ms) + 2 }
  }, [allNotes])

  const yFor = (midi: number) => {
    const span = Math.max(1, maxM - minM)
    return height - ((midi - minM) / span) * (height - 16) - 8
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full bg-ink">
      {layers.map((layer, li) => {
        const fill = LAYER_COLORS[li % LAYER_COLORS.length]
        const phrase = layerPlaybackPhrase(layer.duration || duration, bpm, bars)
        const source = voiceMelody(layer.notes, layer.voicing ?? 'triads', songKey)
        const notes = tileEvents(
          source.map((n) => ({ ...n, time: wrapTime(n.time, phrase) })),
          phrase,
          t,
        )
        const drums = tileEvents(
          layer.drums.map((h) => ({ ...h, time: wrapTime(h.time, phrase) })),
          phrase,
          t,
        )
        return (
          <g key={layer.id}>
            {notes.map((n, i) => (
              <rect
                key={`n-${layer.id}-${i}`}
                x={(n.time / t) * width}
                y={yFor(n.midi) - 4}
                width={Math.max(3, (n.duration / t) * width)}
                height={8}
                rx={2}
                fill={fill}
                opacity={0.35 + n.velocity / 200}
              />
            ))}
            {drums.map((h, i) => {
              const row =
                h.piece === 'kick'
                  ? 158
                  : h.piece === 'snare'
                    ? 134
                    : h.piece === 'clap'
                      ? 110
                      : h.piece === 'rim'
                        ? 86
                        : h.piece === 'tom'
                          ? 62
                          : h.piece === 'crash'
                            ? 14
                            : 38
              return (
                <rect
                  key={`d-${layer.id}-${i}`}
                  x={(h.time / t) * width}
                  y={row + li * 2}
                  width={4}
                  height={18}
                  rx={1}
                  fill={fill}
                  opacity={0.4 + h.velocity / 220}
                />
              )
            })}
          </g>
        )
      })}
      <line
        x1={(playhead / t) * width}
        x2={(playhead / t) * width}
        y1={0}
        y2={height}
        stroke="#e8b86d"
        strokeWidth={1.5}
        opacity={0.35}
      />
    </svg>
  )
}
