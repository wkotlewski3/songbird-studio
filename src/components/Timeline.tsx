import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { LoopRange } from '../audio/engine'
import { barDuration, beatDuration, snapToGrid } from '../audio/metronome'

export function formatTime(seconds: number): string {
  const abs = Math.max(0, seconds)
  const m = Math.floor(abs / 60)
  const s = abs - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

type DragMode = 'seek' | 'region' | 'start' | 'end'

export function Timeline({
  duration,
  bpm,
  playhead,
  loop,
  loopOn,
  children,
  onSeek,
  onScrub,
  onLoop,
  onLoopOn,
}: {
  duration: number
  bpm: number
  playhead: number
  loop: LoopRange | null
  loopOn: boolean
  children: ReactNode
  onSeek: (t: number) => void
  onScrub?: (t: number) => void
  onLoop: (range: LoopRange | null) => void
  onLoopOn: (on: boolean) => void
}) {
  const areaRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: DragMode; origin: number } | null>(null)
  const [draft, setDraft] = useState<LoopRange | null>(null)
  const tMax = Math.max(duration, 0.5)
  const bar = barDuration(bpm)
  const region = draft ?? loop

  const timeAt = (clientX: number) => {
    const el = areaRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return clamp(((clientX - rect.left) / Math.max(1, rect.width)) * tMax, 0, tMax)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const t = timeAt(e.clientX)
    const handle = (e.target as HTMLElement).dataset.handle as 'start' | 'end' | undefined
    e.currentTarget.setPointerCapture(e.pointerId)
    if (handle && loop) {
      drag.current = { mode: handle, origin: t }
      setDraft(loop)
      return
    }
    drag.current = { mode: 'seek', origin: t }
    ;(onScrub ?? onSeek)(t)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const t = timeAt(e.clientX)
    const { mode, origin } = drag.current
    if (mode === 'seek') {
      if (Math.abs(t - origin) > tMax * 0.008) {
        drag.current.mode = 'region'
        const next = { start: Math.min(origin, t), end: Math.max(origin, t) }
        setDraft(next)
      } else {
        ;(onScrub ?? onSeek)(t)
      }
      return
    }
    if (mode === 'region') {
      setDraft({ start: Math.min(origin, t), end: Math.max(origin, t) })
      return
    }
    if (mode === 'start' && loop) {
      setDraft({ start: clamp(t, 0, loop.end - 0.08), end: loop.end })
      return
    }
    setDraft({ start: loop?.start ?? 0, end: clamp(t, (loop?.start ?? 0) + 0.08, tMax) })
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const { mode, origin } = drag.current
    const t = timeAt(e.clientX)
    drag.current = null
    if (mode === 'seek') {
      setDraft(null)
      if (loop && (t < loop.start - 0.02 || t > loop.end + 0.02)) onLoopOn(false)
      onSeek(t)
      return
    }
    const beat = beatDuration(bpm)
    const next =
      mode === 'region'
        ? { start: Math.min(origin, t), end: Math.max(origin, t) }
        : draft
    setDraft(null)
    if (!next || next.end - next.start < 0.08) {
      onSeek(next ? next.start : t)
      return
    }
    let start = snapToGrid(next.start, bpm)
    let end = snapToGrid(next.end, bpm)
    if (end - start < beat / 2) end = start + beat
    onScrub?.(start)
    onLoop({ start, end })
    onLoopOn(true)
  }

  const ticks = (() => {
    const beat = 60 / Math.max(1, bpm)
    const count = tMax / beat
    const step = count > 64 ? beat * 4 : count > 24 ? beat * 2 : beat
    const out: { t: number; bar: boolean }[] = []
    for (let t = 0; t <= tMax + 0.001; t += step) {
      out.push({ t, bar: Math.abs(t / (beat * 4) - Math.round(t / (beat * 4))) < 0.01 })
    }
    return out
  })()

  const pct = (t: number) => `${(t / tMax) * 100}%`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
        <span className="font-mono text-mist">
          {formatTime(playhead)}
          <span className="text-mute"> / {formatTime(tMax)}</span>
        </span>
        {region ? (
          <span className="text-gold">
            {formatTime(region.start)} – {formatTime(region.end)}
          </span>
        ) : (
          <span>Click to jump · drag to loop a region</span>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          {[1, 2, 4, 8, 16].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                onLoop({ start: 0, end: bar * n })
                onLoopOn(true)
              }}
              className={`rounded-full border px-3 py-1 ${
                loopOn && loop && Math.abs(loop.start) < 0.04 && Math.abs(loop.end - bar * n) < 0.06
                  ? 'border-gold bg-gold/15 text-gold'
                  : 'border-line text-mist hover:border-gold'
              }`}
            >
              {n} bar
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, playhead - bar))}
            className="rounded-full border border-line px-3 py-1 text-mist hover:border-gold"
          >
            −1 bar
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.min(tMax, playhead + bar))}
            className="rounded-full border border-line px-3 py-1 text-mist hover:border-gold"
          >
            +1 bar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!loopOn && !loop) onLoop({ start: 0, end: tMax })
              onLoopOn(!loopOn)
            }}
            className={`rounded-full border px-3 py-1 ${
              loopOn ? 'border-gold bg-gold/15 text-gold' : 'border-line text-mist hover:border-gold'
            }`}
          >
            Loop {loopOn ? 'on' : 'off'}
          </button>
          <button
            type="button"
            disabled={!loop}
            onClick={() => {
              onLoop(null)
              onLoopOn(false)
            }}
            className="rounded-full border border-line px-3 py-1 text-mute hover:border-gold disabled:opacity-40"
          >
            Clear region
          </button>
        </span>
      </div>

      <div
        ref={areaRef}
        className="relative cursor-crosshair touch-none select-none rounded-2xl bg-ink"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          onLoop(null)
          onLoopOn(false)
        }}
      >
        <div className="relative h-7 overflow-hidden border-b border-line/70">
          {ticks.map(({ t, bar: isBar }) => (
            <span
              key={t.toFixed(4)}
              className={`absolute top-0 ${isBar ? 'h-full bg-mist/40' : 'h-2 bg-mute/50'}`}
              style={{ left: pct(t), width: 1 }}
            />
          ))}
          {ticks
            .filter((x) => x.bar)
            .map(({ t }) => (
              <span
                key={`l-${t.toFixed(4)}`}
                className="absolute top-2 pl-1 font-mono text-[10px] text-mute"
                style={{ left: pct(t) }}
              >
                {formatTime(t)}
              </span>
            ))}
        </div>

        <div className="relative">
          <div className="pointer-events-none">{children}</div>
          {region && (
            <div
              className={`pointer-events-none absolute inset-y-0 border-x ${
                loopOn ? 'border-gold/80 bg-gold/15' : 'border-mist/40 bg-white/5'
              }`}
              style={{ left: pct(region.start), width: pct(region.end - region.start) }}
            />
          )}
          {region && (
            <>
              <div
                data-handle="start"
                className="absolute inset-y-0 z-10 w-2 cursor-ew-resize bg-gold/0 hover:bg-gold/40"
                style={{ left: `calc(${pct(region.start)} - 4px)` }}
              />
              <div
                data-handle="end"
                className="absolute inset-y-0 z-10 w-2 cursor-ew-resize bg-gold/0 hover:bg-gold/40"
                style={{ left: `calc(${pct(region.end)} - 4px)` }}
              />
            </>
          )}
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-gold"
            style={{ left: pct(playhead) }}
          />
        </div>
      </div>
    </div>
  )
}
