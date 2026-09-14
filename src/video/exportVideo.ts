import type { Session } from '../types'
import { defaultVideo } from '../types'
import { bounceSession } from '../audio/engine'
import { resumeAudio } from '../audio/context'
import { fileBase } from '../audio/export'
import { drawFrame, VIDEO_H, VIDEO_W } from './compose'
import { timeLyrics } from './lyrics'

export function pickRecorderMime(): string {
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export async function recordLyricFilm(opts: {
  session: Session
  canvas: HTMLCanvasElement
  stock: (HTMLImageElement | HTMLVideoElement)[]
  self: HTMLVideoElement[]
  onProgress?: (pct: number, label: string) => void
}): Promise<Blob> {
  const { session, canvas, stock, self, onProgress } = opts
  onProgress?.(0.05, 'Bouncing the mix…')
  const buffer = await bounceSession(session)
  const duration = buffer.duration
  const lyrics = timeLyrics(session.video.lyrics, duration, session.meta.title)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  canvas.width = VIDEO_W
  canvas.height = VIDEO_H

  const ac = await resumeAudio()
  const dest = ac.createMediaStreamDestination()
  const src = ac.createBufferSource()
  src.buffer = buffer
  src.connect(dest)
  src.connect(ac.destination)

  const visual = canvas.captureStream(30)
  const mixed = new MediaStream([...visual.getVideoTracks(), ...dest.stream.getAudioTracks()])
  const mime = pickRecorderMime()
  const rec = mime ? new MediaRecorder(mixed, { mimeType: mime }) : new MediaRecorder(mixed)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onerror = () => reject(new Error('Recording failed'))
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }))
  })

  onProgress?.(0.2, 'Filming…')
  rec.start(250)
  src.start()
  const t0 = ac.currentTime

  await new Promise<void>((resolve) => {
    const tick = () => {
      const time = Math.min(duration, ac.currentTime - t0)
      drawFrame(ctx, {
        time,
        duration,
        bpm: session.meta.bpm,
        video: session.video ?? defaultVideo(),
        stock,
        self,
        lyrics,
        title: session.meta.title,
        artist: session.meta.artist,
      })
      onProgress?.(0.2 + (time / duration) * 0.75, 'Filming…')
      if (time >= duration - 0.03) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  if (rec.state === 'recording') rec.stop()
  src.stop()
  src.disconnect()
  dest.disconnect()
  visual.getTracks().forEach((t) => t.stop())
  onProgress?.(1, 'Writing file…')
  return done
}

export function videoFileName(session: Session): string {
  return `${fileBase(session)} lyric film`
}
