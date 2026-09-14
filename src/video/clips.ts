export type SelfKind = 'camera' | 'screen'

export interface SelfClip {
  id: string
  kind: SelfKind
  url: string
  blob: Blob
}

const clips: SelfClip[] = []
let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let stream: MediaStream | null = null

export function listClips(): SelfClip[] {
  return clips.slice()
}

export function clearClips(): void {
  for (const clip of clips) URL.revokeObjectURL(clip.url)
  clips.length = 0
}

export async function startTape(kind: SelfKind): Promise<void> {
  await stopTape()
  stream =
    kind === 'screen'
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      : await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
  chunks = []
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm'
  recorder = new MediaRecorder(stream, { mimeType: mime })
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.start(200)
}

export async function stopTape(kind: SelfKind = 'camera'): Promise<SelfClip | null> {
  const rec = recorder
  const live = stream
  recorder = null
  stream = null
  if (!rec) {
    live?.getTracks().forEach((t) => t.stop())
    return null
  }
  const blob = await new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }))
    if (rec.state === 'recording') rec.stop()
    else resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }))
  })
  live?.getTracks().forEach((t) => t.stop())
  if (blob.size < 8000) return null
  const clip: SelfClip = {
    id: crypto.randomUUID?.() ?? `v-${Date.now()}`,
    kind,
    blob,
    url: URL.createObjectURL(blob),
  }
  clips.push(clip)
  return clip
}

export function loadClip(clip: SelfClip): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.onloadeddata = () => {
      void video.play().catch(() => undefined)
      resolve(video)
    }
    video.onerror = () => reject(new Error('clip'))
    video.src = clip.url
  })
}
