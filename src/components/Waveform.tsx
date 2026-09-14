import { useEffect, useRef } from 'react'

export function Waveform({ buffer, color = '#9b8ec4' }: { buffer?: AudioBuffer; color?: string }) {
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
    const step = Math.floor(data.length / w)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    for (let x = 0; x < w; x++) {
      let min = 1
      let max = -1
      const start = x * step
      for (let i = 0; i < step; i++) {
        const v = data[start + i] ?? 0
        if (v < min) min = v
        if (v > max) max = v
      }
      const y1 = ((1 - max) / 2) * h
      const y2 = ((1 - min) / 2) * h
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
    }
    ctx.stroke()
  }, [buffer, color])

  return <canvas ref={ref} width={720} height={120} className="h-28 w-full bg-ink" />
}
