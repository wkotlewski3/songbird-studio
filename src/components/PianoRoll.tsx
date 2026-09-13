import { useMemo } from 'react'
import type { DrumHit, MidiNote } from '../types'

export function PianoRoll({
  notes,
  drums,
  duration,
  playhead,
}: {
  notes: MidiNote[]
  drums: DrumHit[]
  duration: number
  playhead: number
}) {
  const width = 720
  const height = 180
  const t = Math.max(duration, 1.2)

  const { minM, maxM } = useMemo(() => {
    if (!notes.length) return { minM: 48, maxM: 72 }
    const ms = notes.map((n) => n.midi)
    return { minM: Math.min(...ms) - 2, maxM: Math.max(...ms) + 2 }
  }, [notes])

  const yFor = (midi: number) => {
    const span = Math.max(1, maxM - minM)
    return height - ((midi - minM) / span) * (height - 16) - 8
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full rounded-2xl bg-ink">
      {notes.map((n, i) => (
        <rect
          key={`n-${i}`}
          x={(n.time / t) * width}
          y={yFor(n.midi) - 4}
          width={Math.max(3, (n.duration / t) * width)}
          height={8}
          rx={2}
          fill="#7dcea0"
          opacity={0.35 + n.velocity / 200}
        />
      ))}
      {drums.map((h, i) => {
        const colors: Record<string, string> = {
          kick: '#e07a5f',
          snare: '#e8b86d',
          hatClosed: '#c8c6bf',
          hatOpen: '#c8c6bf',
          tom: '#9b8ec4',
          crash: '#ffffff',
        }
        const row =
          h.piece === 'kick' ? 150 : h.piece === 'snare' ? 110 : h.piece === 'tom' ? 80 : 40
        return (
          <rect
            key={`d-${i}`}
            x={(h.time / t) * width}
            y={row}
            width={4}
            height={18}
            rx={1}
            fill={colors[h.piece]}
            opacity={0.4 + h.velocity / 220}
          />
        )
      })}
      <line
        x1={(playhead / t) * width}
        x2={(playhead / t) * width}
        y1={0}
        y2={height}
        stroke="#e8b86d"
        strokeWidth={1.5}
        opacity={playhead > 0 ? 0.9 : 0}
      />
    </svg>
  )
}
