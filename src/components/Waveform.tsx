import { useEffect, useRef } from 'react'

export function Waveform({
  buffer,
  color = '#9b8ec4',
  span,
}: {
  buffer?: AudioBuffer
  color?: string
  span?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !buffer) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    const data = buffer.getChannelData(0)
    const phrase = buffer.duration
    const total = Math.max(span ?? phrase, phrase)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    for (let x = 0; x < w; x++) {
      let min = 1
      let max = -1
      const t0 = (x / w) * total
      const t1 = ((x + 1) / w) * total
      const i0 = Math.floor(((t0 % phrase) / phrase) * data.length)
      const i1 = Math.max(i0 + 1, Math.floor(((t1 % phrase) / phrase) * data.length) || data.length)
      if (t1 % phrase < t0 % phrase) {
        for (let i = i0; i < data.length; i++) {
          const v = data[i] ?? 0
          if (v < min) min = v
          if (v > max) max = v
        }
        for (let i = 0; i < i1; i++) {
          const v = data[i] ?? 0
          if (v < min) min = v
          if (v > max) max = v
        }
      } else {
        for (let i = i0; i < i1; i++) {
          const v = data[i] ?? 0
          if (v < min) min = v
          if (v > max) max = v
        }
      }
      const y1 = ((1 - max) / 2) * h
      const y2 = ((1 - min) / 2) * h
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
    }
    ctx.stroke()
  }, [buffer, color, span])

  return <canvas ref={ref} width={720} height={120} className="h-28 w-full bg-ink" />
}
