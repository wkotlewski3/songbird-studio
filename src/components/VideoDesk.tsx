import { useEffect, useRef, useState } from 'react'
import { VIDEO_FILTERS, defaultVideo, type VideoSettings } from '../types'
import { useStudio } from '../state/session'
import { loadClip, startTape, stopTape, type SelfKind } from '../video/clips'
import { drawFrame, VIDEO_H, VIDEO_W } from '../video/compose'
import { recordLyricFilm, videoFileName } from '../video/exportVideo'
import { timeLyrics } from '../video/lyrics'
import { fetchThemeShots, loadShot } from '../video/stock'

export function VideoDesk({
  open,
  onClose,
  generateKey,
}: {
  open: boolean
  onClose: () => void
  generateKey: number
}) {
  const { session, setSession, notify } = useStudio()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stockRef = useRef<(HTMLImageElement | HTMLVideoElement)[]>([])
  const selfRef = useRef<HTMLVideoElement[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [taping, setTaping] = useState<SelfKind | null>(null)
  const [clipCount, setClipCount] = useState(0)
  const video = session.video ?? defaultVideo()

  const patch = (next: Partial<VideoSettings>) =>
    setSession({ ...session, video: { ...(session.video ?? defaultVideo()), ...next } })

  useEffect(() => {
    if (!open) return
    let alive = true
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = VIDEO_W
    canvas.height = VIDEO_H
    const lyrics = timeLyrics(session.video.lyrics, Math.max(8, session.meta.bars * (240 / session.meta.bpm)), session.meta.title)
    const duration = Math.max(8, lyrics[lyrics.length - 1]?.end ?? 8)
    const t0 = performance.now()
    const tick = (now: number) => {
      if (!alive) return
      const time = ((now - t0) / 1000) % duration
      drawFrame(ctx, {
        time,
        duration,
        bpm: session.meta.bpm,
        video: session.video ?? defaultVideo(),
        stock: stockRef.current,
        self: selfRef.current,
        lyrics,
        title: session.meta.title,
        artist: session.meta.artist,
      })
      requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(id)
    }
  }, [open, session.video, session.meta, clipCount])

  const loadStock = async (shots = session.video.stock) => {
    const loaded = await Promise.allSettled(shots.map((shot) => loadShot(shot)))
    stockRef.current = loaded.flatMap((item) => (item.status === 'fulfilled' ? [item.value] : []))
  }

  const generate = async (theme = video.theme) => {
    const want = theme.trim()
    if (!want) {
      notify('Type a theme first — night market, Accra rain, late highway…')
      return
    }
    setBusy('Finding open shots…')
    try {
      const stock = await fetchThemeShots(want)
      patch({ theme: want, stock })
      await loadStock(stock)
      setBusy(null)
      notify(
        stock.length
          ? `Cut a lyric film on “${want}” — ${stock.length} Wikimedia shots. Paste lyrics so people can sing along.`
          : `No Commons shots for “${want}”. The film will use a generated field until you try another theme.`,
      )
    } catch (err) {
      setBusy(null)
      notify(err instanceof Error ? err.message : 'Could not fetch shots')
    }
  }

  useEffect(() => {
    if (!open || !generateKey) return
    if (session.video?.theme.trim()) void generate(session.video.theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, generateKey])

  useEffect(() => {
    if (!open) return
    if (session.video?.stock.length) void loadStock(session.video.stock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const tape = async (kind: SelfKind) => {
    if (taping) {
      const clip = await stopTape(taping)
      setTaping(null)
      if (clip) {
        const el = await loadClip(clip)
        selfRef.current = [...selfRef.current, el]
        setClipCount(selfRef.current.length)
        patch({ useSelf: true })
        notify(kind === 'screen' ? 'Screen take is in the cut.' : 'Camera take is in the cut.')
      }
      return
    }
    try {
      await startTape(kind)
      setTaping(kind)
      notify(kind === 'screen' ? 'Screen is rolling — click again to stop.' : 'Camera is rolling — click again to stop.')
    } catch {
      notify('Could not start that tape. Allow camera or screen share and try again.')
    }
  }

  const download = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setBusy('Bouncing the mix…')
    try {
      const blob = await recordLyricFilm({
        session,
        canvas,
        stock: stockRef.current,
        self: selfRef.current,
        onProgress: (_pct, label) => setBusy(label),
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${videoFileName(session)}.webm`
      a.click()
      URL.revokeObjectURL(a.href)
      notify('Saved the lyric film as WebM. Open it in Chrome or VLC.')
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not finish the film')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 py-8">
      <div className="grid w-full max-w-5xl gap-5 rounded-3xl border border-line bg-panel p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Lyric film</p>
          <h2 className="font-display text-3xl text-white">Theme to picture</h2>
          <p className="mt-1 text-sm text-mute">
            Type a world, pull open-source shots, put the words on top so people can sing along. Record yourself if you
            want to cut in. Tweaks also work from the chat bar.
          </p>
          <canvas ref={canvasRef} className="mt-4 aspect-video w-full rounded-2xl border border-line bg-ink" />
          {!!video.stock.length && (
            <p className="mt-2 text-[11px] text-mute">
              Shots from Wikimedia Commons
              {video.stock[0] ? ` · ${video.stock[0].author}` : ''}
              {video.stock[1] ? `, ${video.stock[1].author}` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-mute">
            Theme
            <input
              value={video.theme}
              onChange={(e) => patch({ theme: e.target.value })}
              placeholder="Africana night market, rain on the highway…"
              className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
            />
          </label>
          <label className="text-xs text-mute">
            Lyrics (sing-along)
            <textarea
              value={video.lyrics}
              onChange={(e) => patch({ lyrics: e.target.value })}
              rows={6}
              placeholder={'One line per line.\nThe current word lights gold.'}
              className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
            />
          </label>
          <p className="text-xs uppercase tracking-widest text-mute">Filter</p>
          <div className="flex flex-wrap gap-1.5">
            {VIDEO_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                title={f.hint}
                onClick={() => patch({ filter: f.id })}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  video.filter === f.id ? 'border-gold text-gold' : 'border-line text-mist'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-xs uppercase tracking-widest text-mute">Cuts</p>
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 4, 8] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => patch({ cutBeats: n })}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  video.cutBeats === n ? 'border-gold text-gold' : 'border-line text-mist'
                }`}
              >
                {n === 1 ? 'Every beat' : `${n} beats`}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-mute">
            Word size
            <input
              type="range"
              className="slider"
              min={0.7}
              max={1.6}
              step={0.05}
              value={video.lyricScale}
              onChange={(e) => patch({ lyricScale: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-mist">
            <input
              type="checkbox"
              checked={video.showWords}
              onChange={(e) => patch({ showWords: e.target.checked })}
            />
            Show lyrics on screen
          </label>
          <label className="flex items-center gap-2 text-xs text-mist">
            <input type="checkbox" checked={video.useSelf} onChange={(e) => patch({ useSelf: e.target.checked })} />
            Cut in my tapes
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void tape('camera')}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                taping === 'camera' ? 'border-drums text-drums' : 'border-line text-mist hover:border-gold'
              }`}
            >
              {taping === 'camera' ? 'Stop camera' : 'Record me'}
            </button>
            <button
              type="button"
              onClick={() => void tape('screen')}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                taping === 'screen' ? 'border-drums text-drums' : 'border-line text-mist hover:border-gold'
              }`}
            >
              {taping === 'screen' ? 'Stop screen' : 'Record screen'}
            </button>
          </div>
          <p className="text-[11px] text-mute">{clipCount} self tape{clipCount === 1 ? '' : 's'} in this tab.</p>
          <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-mute">
              Close
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void generate()}
              className="rounded-full border border-gold/70 px-4 py-2 text-sm text-gold disabled:opacity-60"
            >
              {busy && busy.startsWith('Finding') ? busy : 'Generate film'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void download()}
              className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
            >
              {busy && !busy.startsWith('Finding') ? busy : 'Download WebM'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
