import type { VideoFilter, VideoSettings } from '../types'
import { lineAt, type TimedLine } from './lyrics'

export const VIDEO_W = 1280
export const VIDEO_H = 720

type Media = HTMLImageElement | HTMLVideoElement

const grain = (() => {
  const c = document.createElement('canvas')
  c.width = 160
  c.height = 160
  const g = c.getContext('2d')
  if (g) {
    const data = g.createImageData(160, 160)
    for (let i = 0; i < data.data.length; i += 4) {
      const n = Math.random() * 255
      data.data[i] = n
      data.data[i + 1] = n
      data.data[i + 2] = n
      data.data[i + 3] = 40
    }
    g.putImageData(data, 0, 0)
  }
  return c
})()

function cover(ctx: CanvasRenderingContext2D, media: Media, time: number, index: number, dream: boolean): void {
  const mw = 'videoWidth' in media && media.videoWidth ? media.videoWidth : media.width
  const mh = 'videoHeight' in media && media.videoHeight ? media.videoHeight : media.height
  if (!mw || !mh) return
  const zoom = (dream ? 1.18 : 1.1) + 0.06 * Math.sin(time * 0.12 + index)
  const scale = Math.max(VIDEO_W / mw, VIDEO_H / mh) * zoom
  const dw = mw * scale
  const dh = mh * scale
  const ox = (VIDEO_W - dw) / 2 + Math.cos(time * 0.05 + index) * 18
  const oy = (VIDEO_H - dh) / 2 + Math.sin(time * 0.04 + index * 1.7) * 12
  ctx.drawImage(media, ox, oy, dw, dh)
}

function wash(ctx: CanvasRenderingContext2D, filter: VideoFilter): void {
  if (filter === 'chrome') {
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  } else if (filter === 'night') {
    ctx.fillStyle = 'rgba(8, 18, 48, 0.38)'
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  } else if (filter === 'golden') {
    ctx.fillStyle = 'rgba(232, 184, 109, 0.22)'
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  } else if (filter === 'film') {
    ctx.fillStyle = 'rgba(40, 22, 8, 0.18)'
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  } else if (filter === 'dream') {
    ctx.fillStyle = 'rgba(155, 142, 196, 0.16)'
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  }
  ctx.drawImage(grain, 0, 0, VIDEO_W, VIDEO_H)
  const vig = ctx.createRadialGradient(VIDEO_W / 2, VIDEO_H / 2, 180, VIDEO_W / 2, VIDEO_H / 2, 520)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.62)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  if (filter === 'vhs') {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    for (let y = 0; y < VIDEO_H; y += 3) ctx.fillRect(0, y, VIDEO_W, 1)
  }
}

function fallbackField(ctx: CanvasRenderingContext2D, theme: string, time: number): void {
  let hash = 0
  for (let i = 0; i < theme.length; i++) hash = (hash * 33 + theme.charCodeAt(i)) >>> 0
  const a = `hsl(${hash % 360} 28% 16%)`
  const b = `hsl(${(hash + 40) % 360} 32% 8%)`
  const g = ctx.createLinearGradient(0, 0, VIDEO_W, VIDEO_H)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  ctx.fillStyle = 'rgba(232,184,109,0.12)'
  ctx.beginPath()
  ctx.arc(640 + Math.sin(time * 0.2) * 80, 280, 220, 0, Math.PI * 2)
  ctx.fill()
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur)
      cur = word
    } else cur = next
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  opts: {
    time: number
    duration: number
    bpm: number
    video: VideoSettings
    stock: Media[]
    self: HTMLVideoElement[]
    lyrics: TimedLine[]
    title: string
    artist: string
  },
): void {
  const { time, duration, bpm, video, stock, self, lyrics, title, artist } = opts
  ctx.fillStyle = '#09090b'
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)

  const beat = 60 / Math.max(40, bpm)
  const cut = Math.max(1, video.cutBeats) * beat
  const slot = Math.floor(time / Math.max(0.2, cut))
  const useMe = video.useSelf && self.length > 0 && slot % 4 === 3
  const media = useMe ? self[slot % self.length] : stock.length ? stock[slot % stock.length] : null

  ctx.save()
  if (video.filter === 'chrome') ctx.filter = 'grayscale(1) contrast(1.22) brightness(1.04)'
  if (video.filter === 'dream') ctx.filter = 'blur(0.6px) saturate(1.1) brightness(1.06)'
  if (media) cover(ctx, media, time, slot, video.filter === 'dream')
  else fallbackField(ctx, video.theme || title, time)
  ctx.restore()

  wash(ctx, video.filter)

  if (time < Math.min(2.4, duration * 0.12)) {
    ctx.fillStyle = 'rgba(9,9,11,0.35)'
    ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e8b86d'
    ctx.font = '500 18px "IBM Plex Sans", sans-serif'
    ctx.fillText('SONGBIRD', VIDEO_W / 2, 250)
    ctx.fillStyle = '#fff'
    ctx.font = '700 64px Fraunces, Georgia, serif'
    ctx.fillText(title || 'Untitled sketch', VIDEO_W / 2, 330)
    ctx.fillStyle = '#c8c6bf'
    ctx.font = '400 22px "IBM Plex Sans", sans-serif'
    ctx.fillText(artist || video.theme, VIDEO_W / 2, 380)
  }

  if (video.showWords && lyrics.length) {
    const { line, next, word } = lineAt(lyrics, time)
    const scale = video.lyricScale
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = 18
    ctx.font = `700 ${Math.round(42 * scale)}px Fraunces, Georgia, serif`
    const chunks = wrapWords(ctx, line.text, VIDEO_W - 160)
    chunks.forEach((chunk, i) => {
      const y = 560 - (chunks.length - 1 - i) * 52 * scale
      const parts = chunk.split(/\s+/)
      let x = VIDEO_W / 2 - ctx.measureText(chunk).width / 2
      for (const part of parts) {
        const active = word && part.replace(/[^\p{L}\p{N}]+/gu, '') === word.text.replace(/[^\p{L}\p{N}]+/gu, '')
        ctx.fillStyle = active ? '#e8b86d' : '#f4f1ea'
        ctx.textAlign = 'left'
        ctx.fillText(part, x, y)
        x += ctx.measureText(`${part} `).width
      }
    })
    if (next) {
      ctx.textAlign = 'center'
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(200,198,191,0.55)'
      ctx.font = `500 ${Math.round(20 * scale)}px "IBM Plex Sans", sans-serif`
      ctx.fillText(next.text, VIDEO_W / 2, 640)
    }
    ctx.shadowBlur = 0
  }
}
