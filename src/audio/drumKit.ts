import type { DrumPiece } from '../types'
import { playDrumSynth } from './drumSynth'

const BASE = 'https://cdn.jsdelivr.net/gh/tidalcycles/Dirt-Samples@master'

/** TidalCycles Dirt-Samples — the SuperDirt / Tidal open drum library. */
const FILES: Record<DrumPiece, string[]> = {
  kick: ['bd/BT0A0A7.wav'],
  snare: ['sn/ST0T0S3.wav'],
  hatClosed: ['hc/HHCD0.wav', 'hh/000_hh3closedhh.wav'],
  hatOpen: ['ho/HHOD0.wav'],
  tom: ['lt/LT0D0.wav', 'mt/MT0D0.wav'],
  crash: ['ht/HT0D0.wav', 'ho/HHOD0.wav'],
}

const kit = new Map<DrumPiece, AudioBuffer>()
let loading: Promise<void> | null = null

async function decodeUrl(ac: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await ac.decodeAudioData(await res.arrayBuffer())
  } catch {
    return null
  }
}

export async function loadDirtKit(ac: AudioContext): Promise<void> {
  if (kit.size === Object.keys(FILES).length) return
  if (loading) return loading
  loading = (async () => {
    await Promise.all(
      (Object.keys(FILES) as DrumPiece[]).map(async (piece) => {
        for (const path of FILES[piece]) {
          const buf = await decodeUrl(ac, `${BASE}/${path}`)
          if (buf) {
            kit.set(piece, buf)
            return
          }
        }
      }),
    )
    loading = null
  })()
  return loading
}

export function playDrumSample(
  ctx: BaseAudioContext,
  dest: AudioNode,
  piece: DrumPiece,
  time: number,
  velocity: number,
): void {
  const buffer = kit.get(piece)
  if (!buffer) {
    playDrumSynth(ctx, dest, piece, time, velocity)
    return
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  if (piece === 'crash') src.playbackRate.value = 0.82
  const g = ctx.createGain()
  const v = velocity / 127
  const dur =
    piece === 'kick' ? 0.45 : piece === 'crash' ? 1.4 : piece === 'hatClosed' ? 0.12 : piece === 'hatOpen' ? 0.35 : 0.28
  g.gain.setValueAtTime(Math.max(0.0001, v * 1.05), time)
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  src.connect(g)
  g.connect(dest)
  src.start(time)
  src.stop(time + dur + 0.02)
}

export const DIRT_KIT_CREDIT = 'Drums: Dirt-Samples (TidalCycles / SuperDirt).'