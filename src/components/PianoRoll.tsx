import { useMemo } from 'react'
import type { DrumHit, MidiNote } from '../types'

const LAYER_COLORS = ['#7dcea0', '#e8b86d', '#9b8ec4', '#e07a5f', '#8ecae6']

export function PianoRoll({
  layers,
  duration,
  playhead,
}: {
  layers: { id: string; notes: MidiNote[]; drums: DrumHit[] }[]
  duration: number
  playhead: number
}) {
  const width = 720
  const height = 180
  const t = Math.max(duration, 1.2)
  const allNotes = layers.flatMap((l) => l.notes)

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
        return (
          <g key={layer.id}>
            {layer.notes.map((n, i) => (
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
            {layer.drums.map((h, i) => {
              const row =
                h.piece === 'kick' ? 150 : h.piece === 'snare' ? 110 : h.piece === 'tom' ? 80 : 40
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
