import { resumeAudio } from './context'

export const BEATS_PER_BAR = 4
export const CLICK_FREQ_BEAT = 1108
export const CLICK_FREQ_ACCENT = 1660

export function beatDuration(bpm: number): number {
  return 60 / Math.max(1, bpm)
}

export function barDuration(bpm: number, beatsPerBar = BEATS_PER_BAR): number {
  return beatDuration(bpm) * beatsPerBar
}

export function barsDuration(bpm: number, bars: number, beatsPerBar = BEATS_PER_BAR): number {
  return barDuration(bpm, beatsPerBar) * Math.max(1, bars)
}

export function snapToGrid(time: number, bpm: number, division = 4): number {
  const grid = beatDuration(bpm) / Math.max(1, division)
  return Math.round(time / grid) * grid
}

export function formatBarBeat(time: number, bpm: number, beatsPerBar = BEATS_PER_BAR): string {
  const beat = beatDuration(bpm)
  const total = Math.max(0, time) / beat
  const bar = Math.floor(total / beatsPerBar) + 1
  const b = Math.floor(total % beatsPerBar) + 1
  return `${bar}.${b}`
}

export function currentBeat(time: number, bpm: number): number {
  return Math.floor(Math.max(0, time) / beatDuration(bpm) + 1e-6)
}

let clickMuted = false
let clickBus: GainNode | null = null

export function isClickMuted(): boolean {
  return clickMuted
}

/** Headphones/speakers only — never wired into the recorder, bounce, or layer audio. */
export function setClickMuted(muted: boolean): void {
  clickMuted = muted
  if (clickBus) clickBus.gain.value = muted ? 0 : 1
}

export function clickMonitor(ctx: AudioContext): GainNode {
  if (!clickBus || clickBus.context !== ctx) {
    clickBus = ctx.createGain()
    clickBus.connect(ctx.destination)
  }
  clickBus.gain.value = clickMuted ? 0 : 1
  return clickBus
}

export function silenceClick(): void {
  if (!clickBus) return
  try {
    clickBus.disconnect()
  } catch {
    /* already gone */
  }
  clickBus = null
}

function playClick(ctx: AudioContext, dest: AudioNode, time: number, accent: boolean): void {
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = accent ? CLICK_FREQ_ACCENT : CLICK_FREQ_BEAT
  const g = ctx.createGain()
  const peak = accent ? 0.22 : 0.09
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(peak, time + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.055 : 0.035))
  osc.connect(g)
  g.connect(dest)
  osc.start(time)
  osc.stop(time + 0.07)
}

/** Schedule clicks from `offset` up to `until` (song time), starting at audio `when`. */
export function scheduleClick(
  ctx: AudioContext,
  dest: AudioNode,
  bpm: number,
  when: number,
  offset: number,
  until: number,
  beatsPerBar = BEATS_PER_BAR,
): void {
  const beat = beatDuration(bpm)
  if (until - offset < 0.04) return
  const first = Math.ceil(offset / beat - 1e-4) * beat
  for (let t = first; t < until - 0.008; t += beat) {
    const at = when + (t - offset)
    if (at < when - 0.001) continue
    const index = Math.round(t / beat)
    playClick(ctx, dest, at, index % beatsPerBar === 0)
  }
}

export async function playCountIn(bpm: number, bars = 1): Promise<void> {
  const ctx = await resumeAudio()
  const dest = clickMonitor(ctx)
  const when = ctx.currentTime + 0.04
  const dur = barDuration(bpm) * Math.max(1, bars)
  scheduleClick(ctx, dest, bpm, when, 0, dur)
  await new Promise((resolve) => window.setTimeout(resolve, dur * 1000))
}

export function waitUntil(check: () => boolean, cancelled: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const tick = () => {
      if (cancelled()) {
        resolve(false)
        return
      }
      if (check()) {
        resolve(true)
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}
