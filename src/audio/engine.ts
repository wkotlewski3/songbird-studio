import type { Session, Track } from '../types'
import { GM_DRUM, quantizeDrums } from './drums'
import { playDrumSynth } from './drumSynth'
import { quantizeNotes } from './melody'
import { applyEq, masterChain, vocalGraph } from './mix'
import { loadSoundfont, playSample } from './soundfont'
import { instrumentById } from '../data/instruments'
import { dbToGain, midiToFreq, resumeAudio } from './context'

const audioBuffers = new Map<string, AudioBuffer>()

export function setTrackBuffer(id: string, buffer: AudioBuffer): void {
  audioBuffers.set(id, buffer)
}

export function getTrackBuffer(id: string): AudioBuffer | undefined {
  return audioBuffers.get(id)
}

export function sessionDuration(session: Session): number {
  let max = 2
  for (const t of session.tracks) max = Math.max(max, t.duration)
  return max + 0.6
}

function audible(tracks: Track[], track: Track): boolean {
  if (track.muted) return false
  const anySolo = tracks.some((t) => t.solo)
  return anySolo ? track.solo : true
}

async function schedule(
  ctx: BaseAudioContext,
  session: Session,
  dest: AudioNode,
  when: number,
): Promise<void> {
  for (const track of session.tracks) {
    if (!audible(session.tracks, track)) continue
    const vol = ctx.createGain()
    vol.gain.value = dbToGain(track.gain)
    const pan = ctx.createStereoPanner()
    pan.pan.value = track.pan
    const eqIn = ctx.createGain()
    const eqOut = applyEq(ctx, eqIn, track.eq)
    eqOut.connect(vol)
    vol.connect(pan)
    pan.connect(dest)

    if (track.kind === 'vocals') {
      const buffer = audioBuffers.get(track.id)
      if (!buffer) continue
      const node = vocalGraph(ctx, buffer, track, when)
      node.connect(eqIn)
      continue
    }

    if (track.kind === 'drums') {
      const hits = quantizeDrums(track.drums, session.meta.bpm, track.quantize)
      const inst = instrumentById(track.instrumentId)
      if (inst.id === 'gm-kit') {
        const live = await resumeAudio()
        try {
          const font = await loadSoundfont(live, 'synth_drum')
          for (const hit of hits) {
            playSample(ctx, eqIn, font, GM_DRUM[hit.piece], when + hit.time, hit.duration, hit.velocity / 127)
          }
        } catch {
          for (const hit of hits) playDrumSynth(ctx, eqIn, hit.piece, when + hit.time, hit.velocity)
        }
      } else {
        for (const hit of hits) playDrumSynth(ctx, eqIn, hit.piece, when + hit.time, hit.velocity)
      }
      continue
    }

    const notes = quantizeNotes(track.notes, session.meta.bpm, track.quantize)
    if (!notes.length) continue
    const inst = instrumentById(track.instrumentId)
    const live = await resumeAudio()
    try {
      const font = await loadSoundfont(live, inst.soundfont)
      for (const note of notes) {
        playSample(
          ctx,
          eqIn,
          font,
          note.midi,
          when + note.time,
          note.duration,
          (note.velocity / 127) * 0.9,
        )
      }
    } catch {
      for (const note of notes) {
        playOsc(ctx, eqIn, note.midi, when + note.time, note.duration, note.velocity / 127)
      }
    }
  }
}

function playOsc(
  ctx: BaseAudioContext,
  dest: AudioNode,
  midi: number,
  time: number,
  duration: number,
  velocity: number,
): void {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = midiToFreq(midi)
  const g = ctx.createGain()
  g.gain.setValueAtTime(Math.max(0.0001, velocity * 0.35), time)
  g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.08, duration))
  osc.connect(g)
  g.connect(dest)
  osc.start(time)
  osc.stop(time + duration + 0.05)
}

let outputGain: GainNode | null = null
let startedAt = 0
let playingFlag = false

async function preloadSession(session: Session): Promise<void> {
  const live = await resumeAudio()
  for (const track of session.tracks) {
    if (track.kind === 'melody' && track.notes.length) {
      await loadSoundfont(live, instrumentById(track.instrumentId).soundfont).catch(() => undefined)
    }
    if (track.kind === 'drums' && track.instrumentId === 'gm-kit') {
      await loadSoundfont(live, 'synth_drum').catch(() => undefined)
    }
  }
}

export async function playSession(session: Session): Promise<void> {
  stopSession()
  const ctx = await resumeAudio()
  await preloadSession(session)
  const gain = ctx.createGain()
  outputGain = gain
  playingFlag = true
  startedAt = ctx.currentTime + 0.08
  const master = masterChain(ctx, session.master)
  master.output.connect(gain)
  gain.connect(ctx.destination)
  await schedule(ctx, session, master.input, startedAt)
}

export function stopSession(): void {
  if (outputGain) {
    const now = outputGain.context.currentTime
    outputGain.gain.cancelScheduledValues(now)
    outputGain.gain.setValueAtTime(outputGain.gain.value, now)
    outputGain.gain.linearRampToValueAtTime(0, now + 0.04)
    const node = outputGain
    window.setTimeout(() => {
      try {
        node.disconnect()
      } catch {
        /* already gone */
      }
    }, 80)
  }
  outputGain = null
  playingFlag = false
}

export function isPlaying(): boolean {
  return playingFlag
}

export function playbackTime(): number {
  if (!playingFlag || !outputGain) return 0
  return Math.max(0, outputGain.context.currentTime - startedAt)
}

export async function bounceSession(session: Session): Promise<AudioBuffer> {
  const live = await resumeAudio()
  await preloadSession(session)
  const duration = sessionDuration(session)
  const offline = new OfflineAudioContext(2, Math.ceil(duration * live.sampleRate), live.sampleRate)
  const master = masterChain(offline, session.master)
  master.output.connect(offline.destination)
  await schedule(offline, session, master.input, 0)
  return offline.startRendering()
}

/** Warm the chosen melody soundfont so Play is instant. */
export async function preloadInstrument(instrumentId: string): Promise<void> {
  const inst = instrumentById(instrumentId)
  if (inst.kind !== 'melody' && inst.id !== 'gm-kit') return
  const ac = await resumeAudio()
  await loadSoundfont(ac, inst.soundfont)
}
