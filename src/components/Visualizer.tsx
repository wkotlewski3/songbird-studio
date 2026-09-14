import { useEffect, useRef } from 'react'
import {
  getLayerAnalyser,
  getMasterAnalyser,
  getTrackAnalyser,
} from '../audio/engine'
import type { Track } from '../types'

const KIND_COLOR: Record<Track['kind'], string> = {
  melody: '#7dcea0',
  drums: '#e07a5f',
  vocals: '#9b8ec4',
}

function hexRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

export function Visualizer({
  layerId,
  trackId,
  master,
  color = '#e8b86d',
  variant = 'hero',
}: {
  layerId?: string
  trackId?: string
  master?: boolean
  color?: string
  variant?: 'hero' | 'strip'
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const freq = new Uint8Array(1024)
    const wave = new Uint8Array(1024)

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, wrap.clientWidth)
      const h = Math.max(1, wrap.clientHeight)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const pick = () => {
      if (layerId) {
        const layer = getLayerAnalyser(layerId)
        if (layer) return layer
      }
      if (trackId) {
        const track = getTrackAnalyser(trackId)
        if (track) return track
      }
      return master || !layerId ? getMasterAnalyser() : null
    }

    const tick = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      ctx.clearRect(0, 0, w, h)
      const analyser = pick()
      const mid = h / 2
      if (!analyser) {
        ctx.strokeStyle = rgba(color, 0.25)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, mid)
        ctx.lineTo(w, mid)
        ctx.stroke()
        raf = requestAnimationFrame(tick)
        return
      }

      const bins = Math.min(freq.length, analyser.frequencyBinCount)
      analyser.getByteFrequencyData(freq)
      analyser.getByteTimeDomainData(wave)

      const usable = Math.floor(bins * 0.55)
      const barW = w / usable
      const glow = ctx.createLinearGradient(0, 0, 0, h)
      glow.addColorStop(0, rgba(color, 0.08))
      glow.addColorStop(0.5, rgba(color, 0.2))
      glow.addColorStop(1, rgba(color, 0.05))
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      for (let i = 0; i < usable; i++) {
        const v = freq[i] / 255
        const bh = Math.max(1, v * h * (variant === 'hero' ? 0.46 : 0.42))
        ctx.fillStyle = rgba(color, 0.22 + v * 0.7)
        ctx.fillRect(i * barW, mid - bh, Math.max(1, barW - 0.6), bh * 2)
      }

      ctx.beginPath()
      ctx.strokeStyle = '#f7f4ee'
      ctx.shadowColor = color
      ctx.shadowBlur = variant === 'hero' ? 16 : 8
      ctx.lineWidth = variant === 'hero' ? 2 : 1.25
      const samples = analyser.fftSize
      const step = Math.max(1, Math.floor(samples / Math.max(64, w)))
      for (let i = 0, x = 0; i < samples; i += step, x++) {
        const t = wave[i] ?? 128
        const y = mid + ((t - 128) / 128) * h * 0.4
        const px = (i / samples) * w
        if (i === 0) ctx.moveTo(px, y)
        else ctx.lineTo(px, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [layerId, trackId, master, color, variant])

  const height = variant === 'hero' ? 'h-36 sm:h-44' : 'h-8'
  return (
    <div ref={wrapRef} className={`${height} w-full overflow-hidden rounded-2xl bg-ink`}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}

export function MixVisualizer({ tracks }: { tracks: Track[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  const signature = tracks.map((t) => `${t.id}:${t.kind}`).join('|')

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const freq = new Uint8Array(512)
    const wave = new Uint8Array(2048)

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, wrap.clientWidth)
      const h = Math.max(1, wrap.clientHeight)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const tick = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      ctx.clearRect(0, 0, w, h)
      const mid = h / 2
      const master = getMasterAnalyser()

      tracksRef.current.forEach((track, ti) => {
        const analyser = getTrackAnalyser(track.id)
        if (!analyser) return
        analyser.getByteFrequencyData(freq)
        const color = KIND_COLOR[track.kind]
        const usable = Math.floor(Math.min(freq.length, analyser.frequencyBinCount) * 0.5)
        const barW = w / usable
        const lane = ((ti % 3) - 1) * 4
        for (let i = 0; i < usable; i++) {
          const v = freq[i] / 255
          if (v < 0.04) continue
          const bh = v * h * 0.38
          ctx.fillStyle = rgba(color, 0.18 + v * 0.45)
          ctx.fillRect(i * barW, mid - bh + lane, Math.max(1, barW - 0.4), bh * 2)
        }
      })

      if (master) {
        master.getByteTimeDomainData(wave)
        ctx.beginPath()
        ctx.strokeStyle = '#e8b86d'
        ctx.shadowColor = '#e8b86d'
        ctx.shadowBlur = 14
        ctx.lineWidth = 2
        const n = master.fftSize
        for (let i = 0; i < n; i++) {
          const px = (i / n) * w
          const y = mid + ((wave[i] - 128) / 128) * h * 0.42
          if (i === 0) ctx.moveTo(px, y)
          else ctx.lineTo(px, y)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      } else {
        ctx.strokeStyle = 'rgba(232,184,109,0.25)'
        ctx.beginPath()
        ctx.moveTo(0, mid)
        ctx.lineTo(w, mid)
        ctx.stroke()
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [signature])

  return (
    <div ref={wrapRef} className="h-24 w-full overflow-hidden rounded-2xl bg-ink">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}

export const visColor = KIND_COLOR
