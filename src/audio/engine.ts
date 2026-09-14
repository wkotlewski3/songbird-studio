import type { Layer, Session, Track } from '../types'
import { trackDuration } from '../types'
import { GM_DRUM, quantizeDrums, type DrumAnalysis } from './drums'
import { playDrumSample, loadDrumVoices, isDirtStyle, resolveDrumSample } from './drumKit'
import { type MelodyAnalysis } from './melody'
import { applyEq, masterChain, vocalGraph } from './mix'
import { isLayerAudible } from './mixerState'
import { getCachedSoundfont, loadSoundfont, playSample } from './soundfont'
import { instrumentById } from '../data/instruments'
import { dbToGain, midiToFreq, resumeAudio } from './context'
import { barsDuration, clickMonitor, scheduleClick, setClickMuted as muteClick, isClickMuted as clickIsMuted, silenceClick } from './metronome'
import { layerPlaybackPhrase, layerSlotsPerBeat, tileEvents, wrapTime } from './grid'
import { realizedNotes } from './voicing'

const audioBuffers = new Map<string, AudioBuffer>()
export type LayerAnalysis =
  | { kind: 'melody'; melody: MelodyAnalysis }
  | { kind: 'drums'; drums: DrumAnalysis }
const analyses = new Map<string, LayerAnalysis>()

type Bus = {
  mute: GainNode
  vol: GainNode
  pan: StereoPannerNode
}

const layerBus = new Map<string, Bus>()
const trackBus = new Map<string, Bus>()
const layerAnalysers = new Map<string, AnalyserNode>()
const trackAnalysers = new Map<string, AnalyserNode>()
let masterAnalyser: AnalyserNode | null = null

function isOffline(ctx: BaseAudioContext): boolean {
  return 'startRendering' in ctx
}

function tapAnalyser(ctx: BaseAudioContext, node: AudioNode, fftSize: number): AnalyserNode {
  const analyser = ctx.createAnalyser()
  analyser.fftSize = fftSize
  analyser.smoothingTimeConstant = 0.72
  analyser.minDecibels = -82
  analyser.maxDecibels = -16
  node.connect(analyser)
  return analyser
}

export function getMasterAnalyser(): AnalyserNode | null {
  return masterAnalyser
}

export function getLayerAnalyser(id: string): AnalyserNode | null {
  return layerAnalysers.get(id) ?? null
}

export function getTrackAnalyser(id: string): AnalyserNode | null {
  return trackAnalysers.get(id) ?? null
}

function clearAnalysers(): void {
  layerAnalysers.clear()
  trackAnalysers.clear()
  masterAnalyser = null
}

export function setLayerBuffer(id: string, buffer: AudioBuffer): void {
  audioBuffers.set(id, buffer)
}

export function getLayerBuffer(id: string): AudioBuffer | undefined {
  return audioBuffers.get(id)
}

export function setLayerAnalysis(id: string, analysis: LayerAnalysis): void {
  analyses.set(id, analysis)
}

export function getLayerAnalysis(id: string): LayerAnalysis | undefined {
  return analyses.get(id)
}

export function clearAllLayerAudio(): void {
  audioBuffers.clear()
  analyses.clear()
}

/** @deprecated use setLayerBuffer — kept so older call sites compile during the mixer cutover */
export const setTrackBuffer = setLayerBuffer
export const getTrackBuffer = getLayerBuffer

export function sketchDuration(session: Session): number {
  let max = barsDuration(session.meta.bpm, session.meta.bars)
  for (const t of session.tracks) max = Math.max(max, trackDuration(t))
  return max
}

export function sessionDuration(session: Session): number {
  return sketchDuration(session) + 0.25
}

function makeBus(ctx: BaseAudioContext): Bus {
  const mute = ctx.createGain()
  const vol = ctx.createGain()
  const pan = ctx.createStereoPanner()
  mute.connect(vol)
  vol.connect(pan)
  return { mute, vol, pan }
}

type MixerMaps = { layers: Map<string, Bus>; tracks: Map<string, Bus> }

const liveMixer: MixerMaps = { layers: layerBus, tracks: trackBus }

export function applyMixerState(session: Session, maps: MixerMaps = liveMixer): void {
  for (const track of session.tracks) {
    const tBus = maps.tracks.get(track.id)
    if (tBus) {
      tBus.vol.gain.value = dbToGain(track.gain)
      tBus.pan.pan.value = track.pan
      tBus.mute.gain.value = track.muted ? 0 : 1
    }
    for (const layer of track.layers) {
      const lBus = maps.layers.get(layer.id)
      if (!lBus) continue
      lBus.vol.gain.value = dbToGain(layer.gain)
      lBus.pan.pan.value = layer.pan
      lBus.mute.gain.value = isLayerAudible(session.tracks, track, layer) ? 1 : 0
    }
  }
}

export type LoopRange = { start: number; end: number }
export type PlayOpts = { offset?: number; loop?: LoopRange | null }

function playOriginal(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  dest: AudioNode,
  when: number,
  gain: number,
  offset = 0,
  until?: number,
): void {
  if (offset >= buffer.duration) return
  let playDur = buffer.duration - offset
  if (until != null) playDur = Math.min(playDur, until - offset)
  if (playDur <= 0) return
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const g = ctx.createGain()
  g.gain.value = Math.max(0.0001, gain)
  src.connect(g)
  g.connect(dest)
  src.start(when, offset)
  src.stop(when + playDur + 0.02)
}

function playTiledBuffer(
  buffer: AudioBuffer,
  when: number,
  songOffset: number,
  until: number | undefined,
  play: (audioWhen: number, localOff: number, localUntil: number) => void,
  phrase = buffer.duration,
): void {
  const cycle = phrase > 0.05 ? phrase : buffer.duration
  const songEnd = until ?? songOffset + cycle
  if (cycle < 0.05 || songEnd <= songOffset) return
  const first = Math.floor(songOffset / cycle + 1e-9) * cycle
  for (let start = first; start < songEnd - 0.005; start += cycle) {
    const localOff = Math.max(0, songOffset - start)
    const localEnd = Math.min(cycle, songEnd - start)
    if (localEnd - localOff < 0.01) continue
    play(when + (start + localOff - songOffset), localOff, localEnd)
  }
}

function eventWhen(eventTime: number, offset: number, when: number, until?: number): number | null {
  if (eventTime < offset - 0.01) return null
  if (until != null && eventTime >= until) return null
  return when + (eventTime - offset)
}

function clipDur(start: number, duration: number, until?: number): number {
  if (until == null) return duration
  return Math.max(0.01, Math.min(duration, until - start))
}

function scheduleLayer(
  ctx: BaseAudioContext,
  session: Session,
  track: Track,
  layer: Layer,
  dest: AudioNode,
  when: number,
  offset = 0,
  until?: number,
): void {
  const eqIn = ctx.createGain()
  const eqOut = applyEq(ctx, eqIn, layer.eq)
  eqOut.connect(dest)
  const buffer = audioBuffers.get(layer.id)
  const horizon = until ?? sketchDuration(session)
  const phrase = layerPlaybackPhrase(layer.duration || buffer?.duration || 0, session.meta.bpm, session.meta.bars)

  if (track.kind === 'vocals') {
    if (!buffer) return
    playTiledBuffer(buffer, when, offset, horizon, (audioWhen, localOff, localEnd) => {
      vocalGraph(ctx, buffer, layer, audioWhen, localOff, localEnd, session.meta.bpm).connect(eqIn)
    }, phrase)
    return
  }

  const origAmt = layer.accepted ? layer.originalMix : buffer ? 1 : 0
  const midiAmt = layer.accepted ? 1 - layer.originalMix : 0
  if (buffer && origAmt > 0.02) {
    playTiledBuffer(buffer, when, offset, horizon, (audioWhen, localOff, localEnd) => {
      playOriginal(ctx, buffer, eqIn, audioWhen, origAmt, localOff, localEnd)
    }, phrase)
  }
  if (midiAmt <= 0.02) return

  const midiGain = ctx.createGain()
  midiGain.gain.value = midiAmt
  midiGain.connect(eqIn)

  if (track.kind === 'drums') {
    const hits = tileEvents(
      quantizeDrums(layer.drums, session.meta.bpm, layer.quantize, layerSlotsPerBeat(layer)).map((h) => ({
        ...h,
        time: wrapTime(h.time, phrase),
      })),
      phrase,
      horizon,
    )
    const inst = instrumentById(layer.instrumentId)
    if (inst.id === 'gm-kit') {
      const font = getCachedSoundfont('synth_drum')
      if (font) {
        for (const hit of hits) {
          const at = eventWhen(hit.time, offset, when, until)
          if (at === null) continue
          playSample(
            ctx,
            midiGain,
            font,
            GM_DRUM[hit.piece] ?? 38,
            at,
            clipDur(hit.time, hit.duration, until),
            hit.velocity / 127,
          )
        }
        return
      }
    }
    for (const hit of hits) {
      const at = eventWhen(hit.time, offset, when, until)
      if (at === null) continue
      playDrumSample(
        ctx,
        midiGain,
        hit.piece,
        at,
        hit.velocity,
        resolveDrumSample(layer.instrumentId, hit.piece, layer.drumVoices),
      )
    }
    return
  }

  const notes = tileEvents(
    realizedNotes(layer, session.meta.bpm, session.meta.key).map((n) => ({
      ...n,
      time: wrapTime(n.time, phrase),
    })),
    phrase,
    horizon,
  )
  if (!notes.length) return
  const inst = instrumentById(layer.instrumentId)
  const font = getCachedSoundfont(inst.soundfont)
  if (font) {
    for (const note of notes) {
      const at = eventWhen(note.time, offset, when, until)
      if (at === null) continue
      playSample(
        ctx,
        midiGain,
        font,
        note.midi,
        at,
        clipDur(note.time, note.duration, until),
        (note.velocity / 127) * 0.9,
      )
    }
    return
  }
  for (const note of notes) {
    const at = eventWhen(note.time, offset, when, until)
    if (at === null) continue
    playOsc(ctx, midiGain, note.midi, at, clipDur(note.time, note.duration, until), note.velocity / 127)
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

function wireSession(
  ctx: BaseAudioContext,
  session: Session,
  masterIn: AudioNode,
  when: number,
  maps: MixerMaps = liveMixer,
  offset = 0,
  until?: number,
): void {
  maps.layers.clear()
  maps.tracks.clear()
  if (!isOffline(ctx)) {
    layerAnalysers.clear()
    trackAnalysers.clear()
  }
  for (const track of session.tracks) {
    const tBus = makeBus(ctx)
    maps.tracks.set(track.id, tBus)
    tBus.pan.connect(masterIn)
    if (!isOffline(ctx)) trackAnalysers.set(track.id, tapAnalyser(ctx, tBus.pan, 256))
    for (const layer of track.layers) {
      const lBus = makeBus(ctx)
      maps.layers.set(layer.id, lBus)
      lBus.pan.connect(tBus.mute)
      if (!isOffline(ctx)) layerAnalysers.set(layer.id, tapAnalyser(ctx, lBus.pan, 512))
      scheduleLayer(ctx, session, track, layer, lBus.mute, when, offset, until)
    }
  }
  applyMixerState(session, maps)
}

async function preloadSession(session: Session): Promise<void> {
  const live = await resumeAudio()
  const fonts = new Set<string>()
  const dirtLoads: Promise<void>[] = []
  for (const track of session.tracks) {
    for (const layer of track.layers) {
      if (track.kind === 'melody' && layer.notes.length) {
        fonts.add(instrumentById(layer.instrumentId).soundfont)
      }
      if (track.kind === 'drums' && layer.instrumentId === 'gm-kit') fonts.add('synth_drum')
      if (track.kind === 'drums' && isDirtStyle(layer.instrumentId)) {
        dirtLoads.push(loadDrumVoices(live, layer.instrumentId, layer.drumVoices))
      }
    }
  }
  await Promise.all([
    ...[...fonts].map((name) => loadSoundfont(live, name).catch(() => undefined)),
    ...dirtLoads.map((p) => p.catch(() => undefined)),
  ])
}

let outputGain: GainNode | null = null
let startedAt = 0
let playOffset = 0
let playingFlag = false
let activeLoop: LoopRange | null = null
let loopMarker: OscillatorNode | null = null
let replay: (() => Promise<void>) | null = null
let liveSession: Session | null = null

export function setLiveSession(session: Session | null): void {
  liveSession = session
}

export function setClickMuted(muted: boolean): void {
  muteClick(muted)
}

export function isClickMuted(): boolean {
  return clickIsMuted()
}

function clearLoopMarker(): void {
  if (!loopMarker) return
  loopMarker.onended = null
  try {
    loopMarker.stop()
  } catch {
    /* already stopped */
  }
  loopMarker = null
}

function armLoop(ctx: AudioContext, until: number, offset: number): void {
  const dur = until - offset
  if (dur <= 0.04) return
  const marker = ctx.createOscillator()
  const silent = ctx.createGain()
  silent.gain.value = 0
  marker.connect(silent)
  silent.connect(ctx.destination)
  marker.start(startedAt)
  marker.stop(startedAt + dur)
  marker.onended = () => {
    const fn = replay
    if (fn) void fn()
  }
  loopMarker = marker
}

export function getLoop(): LoopRange | null {
  return activeLoop
}

export async function playSession(session: Session, opts: PlayOpts = {}): Promise<void> {
  stopSession()
  liveSession = session
  const offset = Math.max(0, opts.offset ?? 0)
  activeLoop = opts.loop && opts.loop.end - opts.loop.start > 0.05 ? opts.loop : null
  const until = activeLoop?.end
  const ctx = await resumeAudio()
  await preloadSession(session)
  const gain = ctx.createGain()
  outputGain = gain
  playingFlag = true
  playOffset = offset
  startedAt = ctx.currentTime + 0.05
  const master = masterChain(ctx, session.master)
  master.output.connect(gain)
  gain.connect(ctx.destination)
  masterAnalyser = tapAnalyser(ctx, gain, 1024)
  wireSession(ctx, session, master.input, startedAt, liveMixer, offset, until)
  const clickUntil = until ?? sketchDuration(session)
  scheduleClick(ctx, clickMonitor(ctx), session.meta.bpm, startedAt, offset, clickUntil)
  replay = activeLoop
    ? () => playSession(liveSession ?? session, { offset: activeLoop!.start, loop: activeLoop })
    : null
  if (activeLoop) armLoop(ctx, activeLoop.end, offset)
}

export function stopSession(): void {
  clearLoopMarker()
  replay = null
  silenceClick()
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
  layerBus.clear()
  trackBus.clear()
  clearAnalysers()
}

export function isPlaying(): boolean {
  return playingFlag
}

export function playbackTime(): number {
  if (!playingFlag || !outputGain) return playOffset
  return playOffset + Math.max(0, outputGain.context.currentTime - startedAt)
}

export async function bounceSession(session: Session): Promise<AudioBuffer> {
  const live = await resumeAudio()
  await preloadSession(session)
  const duration = sessionDuration(session)
  const offline = new OfflineAudioContext(2, Math.ceil(duration * live.sampleRate), live.sampleRate)
  const master = masterChain(offline, session.master)
  master.output.connect(offline.destination)
  const maps: MixerMaps = { layers: new Map(), tracks: new Map() }
  wireSession(offline, session, master.input, 0, maps, 0)
  return offline.startRendering()
}

export async function preloadInstrument(
  instrumentId: string,
  voices?: Layer['drumVoices'],
): Promise<void> {
  const inst = instrumentById(instrumentId)
  const ac = await resumeAudio()
  if (inst.soundfont === 'analog') return
  if (isDirtStyle(instrumentId) || inst.soundfont === 'dirt') {
    await loadDrumVoices(ac, instrumentId, voices)
    return
  }
  if (inst.kind !== 'melody' && inst.id !== 'gm-kit') return
  await loadSoundfont(ac, inst.soundfont)
}

export async function previewOriginal(layerId: string, opts: PlayOpts = {}): Promise<void> {
  stopSession()
  const buffer = audioBuffers.get(layerId)
  if (!buffer) return
  const offset = Math.max(0, opts.offset ?? 0)
  activeLoop = opts.loop && opts.loop.end - opts.loop.start > 0.05 ? opts.loop : null
  const ctx = await resumeAudio()
  const gain = ctx.createGain()
  outputGain = gain
  playingFlag = true
  playOffset = offset
  startedAt = ctx.currentTime
  gain.connect(ctx.destination)
  masterAnalyser = tapAnalyser(ctx, gain, 1024)
  playTiledBuffer(buffer, startedAt, offset, activeLoop?.end, (audioWhen, localOff, localEnd) => {
    playOriginal(ctx, buffer, gain, audioWhen, 1, localOff, localEnd)
  })
  replay = activeLoop ? () => previewOriginal(layerId, { offset: activeLoop!.start, loop: activeLoop }) : null
  if (activeLoop) armLoop(ctx, activeLoop.end, offset)
}

export async function previewInterpretation(
  session: Session,
  track: Track,
  layer: Layer,
  opts: PlayOpts = {},
): Promise<void> {
  stopSession()
  const forced: Layer = { ...layer, accepted: true, originalMix: 0 }
  const offset = Math.max(0, opts.offset ?? 0)
  activeLoop = opts.loop && opts.loop.end - opts.loop.start > 0.05 ? opts.loop : null
  const ctx = await resumeAudio()
  await preloadSession({ ...session, tracks: [{ ...track, layers: [forced] }] })
  const gain = ctx.createGain()
  outputGain = gain
  playingFlag = true
  playOffset = offset
  startedAt = ctx.currentTime + 0.05
  gain.connect(ctx.destination)
  masterAnalyser = tapAnalyser(ctx, gain, 1024)
  scheduleLayer(ctx, session, track, forced, gain, startedAt, offset, activeLoop?.end)
  replay = activeLoop
    ? () => previewInterpretation(session, track, layer, { offset: activeLoop!.start, loop: activeLoop })
    : null
  if (activeLoop) armLoop(ctx, activeLoop.end, offset)
}
