import type { EqState, Layer, MasterSettings, VocalEcho, VocalReverb, VocalRole, VocalTone } from '../types'
import { defaultVocalEcho, defaultVocalReverb, defaultVocalTone } from '../types'
import { dbToGain } from './context'

export function applyEq(ctx: BaseAudioContext, source: AudioNode, eq: EqState): AudioNode {
  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 120
  low.gain.value = eq.low

  const mid = ctx.createBiquadFilter()
  mid.type = 'peaking'
  mid.frequency.value = 700
  mid.Q.value = 0.8
  mid.gain.value = eq.mid

  const presence = ctx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 3200
  presence.Q.value = 1.1
  presence.gain.value = eq.presence

  const air = ctx.createBiquadFilter()
  air.type = 'highshelf'
  air.frequency.value = 9000
  air.gain.value = eq.air

  source.connect(low)
  low.connect(mid)
  mid.connect(presence)
  presence.connect(air)
  return air
}

const ROLE: Record<VocalRole, { hp: number; presence: number; air: number; compress: number; width: number }> = {
  lead: { hp: 100, presence: 2.2, air: 1.6, compress: 0.62, width: 0.05 },
  verse: { hp: 85, presence: 0.8, air: 0.2, compress: 0.4, width: 0.02 },
  chorus: { hp: 105, presence: 2.6, air: 2.6, compress: 0.55, width: 0.38 },
  double: { hp: 110, presence: 1.6, air: 1.1, compress: 0.48, width: 0.48 },
  harmony: { hp: 125, presence: 2, air: 2.2, compress: 0.5, width: 0.42 },
}

const TONE: Record<
  VocalTone,
  { hp: number; mud: number; presence: number; air: number; deess: number; compress: number; lp: number | null; sat: number }
> = {
  studio: { hp: 18, mud: -2.4, presence: 2.4, air: 1.8, deess: -5.5, compress: 0.14, lp: null, sat: 0.55 },
  warm: { hp: -8, mud: 1.2, presence: 0.2, air: -1.4, deess: -2.2, compress: 0, lp: 11000, sat: 0.15 },
  airy: { hp: 12, mud: -1.2, presence: 1.1, air: 3.4, deess: -3.2, compress: 0.04, lp: null, sat: 0.1 },
  radio: { hp: 320, mud: 2.4, presence: 4.2, air: -7, deess: -1.2, compress: 0.18, lp: 3400, sat: 0.7 },
}

const REVERB: Record<VocalReverb, { seconds: number; decay: number; pre: number; wet: number }> = {
  dry: { seconds: 0.12, decay: 6, pre: 0.004, wet: 0.03 },
  room: { seconds: 0.38, decay: 4.4, pre: 0.008, wet: 0.12 },
  plate: { seconds: 1.15, decay: 2.7, pre: 0.018, wet: 0.24 },
  hall: { seconds: 2.15, decay: 2.15, pre: 0.032, wet: 0.34 },
  cathedral: { seconds: 3.6, decay: 1.75, pre: 0.048, wet: 0.46 },
}

const ECHO: Record<VocalEcho, { beats: number; extra: number; feedback: number; mix: number; ping: boolean; dark: number }> = {
  off: { beats: 0, extra: 0, feedback: 0, mix: 0, ping: false, dark: 6000 },
  slap: { beats: 0, extra: 0.082, feedback: 0.08, mix: 0.16, ping: false, dark: 5500 },
  eighth: { beats: 0.5, extra: 0, feedback: 0.28, mix: 0.28, ping: false, dark: 4200 },
  quarter: { beats: 1, extra: 0, feedback: 0.32, mix: 0.3, ping: false, dark: 3800 },
  dub: { beats: 0.75, extra: 0, feedback: 0.52, mix: 0.36, ping: false, dark: 2600 },
  pingpong: { beats: 0.5, extra: 0, feedback: 0.34, mix: 0.3, ping: true, dark: 4000 },
}

const impulseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>()

function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const key = `${seconds}:${decay}:${ctx.sampleRate}`
  let map = impulseCache.get(ctx)
  if (!map) {
    map = new Map()
    impulseCache.set(ctx, map)
  }
  const hit = map.get(key)
  if (hit) return hit
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c)
    const shift = c === 1 ? Math.floor(ctx.sampleRate * 0.0018) : 0
    for (let i = 0; i < len; i++) {
      const t = Math.max(0, i - shift)
      data[i] = (Math.random() * 2 - 1) * (1 - t / len) ** decay
    }
  }
  map.set(key, buf)
  return buf
}

function saturator(ctx: BaseAudioContext, amount: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper()
  const n = 257
  const curve = new Float32Array(n)
  const k = 0.4 + amount * 1.8
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * k) / Math.tanh(k)
  }
  shaper.curve = curve
  shaper.oversample = '2x'
  return shaper
}

function connectReverb(ctx: BaseAudioContext, from: AudioNode, to: AudioNode, kind: VocalReverb): void {
  const spec = REVERB[kind]
  if (kind === 'dry' || spec.wet < 0.04) return
  const pre = ctx.createDelay(0.1)
  pre.delayTime.value = spec.pre
  const conv = ctx.createConvolver()
  conv.buffer = makeImpulse(ctx, spec.seconds, spec.decay)
  const hip = ctx.createBiquadFilter()
  hip.type = 'highpass'
  hip.frequency.value = 180
  const wet = ctx.createGain()
  wet.gain.value = spec.wet
  from.connect(pre)
  pre.connect(hip)
  hip.connect(conv)
  conv.connect(wet)
  wet.connect(to)
}

function connectEcho(ctx: BaseAudioContext, from: AudioNode, to: AudioNode, kind: VocalEcho, bpm: number): void {
  const spec = ECHO[kind]
  if (spec.mix <= 0.01) return
  const beat = 60 / Math.max(40, bpm)
  const time = Math.min(1.8, Math.max(0.03, spec.beats * beat + spec.extra))
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 220
  const dark = ctx.createBiquadFilter()
  dark.type = 'lowpass'
  dark.frequency.value = spec.dark
  const mix = ctx.createGain()
  mix.gain.value = spec.mix
  from.connect(hp)

  if (spec.ping) {
    const left = ctx.createDelay(2)
    const right = ctx.createDelay(2)
    left.delayTime.value = time
    right.delayTime.value = time
    const fb = ctx.createGain()
    fb.gain.value = spec.feedback
    const panL = ctx.createStereoPanner()
    const panR = ctx.createStereoPanner()
    panL.pan.value = -0.85
    panR.pan.value = 0.85
    hp.connect(left)
    left.connect(dark)
    dark.connect(right)
    right.connect(fb)
    fb.connect(left)
    left.connect(panL)
    right.connect(panR)
    panL.connect(mix)
    panR.connect(mix)
    mix.connect(to)
    return
  }

  const delay = ctx.createDelay(2)
  delay.delayTime.value = time
  const fb = ctx.createGain()
  fb.gain.value = spec.feedback
  hp.connect(delay)
  delay.connect(dark)
  dark.connect(fb)
  fb.connect(delay)
  delay.connect(mix)
  mix.connect(to)
}

export function vocalGraph(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  layer: Pick<Layer, 'vocalRole' | 'vocalTone' | 'vocalReverb' | 'vocalEcho' | 'eq'>,
  when: number,
  offset = 0,
  until?: number,
  bpm = 92,
): AudioNode {
  const role = ROLE[layer.vocalRole] ?? ROLE.lead
  const tone = TONE[layer.vocalTone ?? defaultVocalTone()]
  const verb = layer.vocalReverb ?? defaultVocalReverb()
  const echo = layer.vocalEcho ?? defaultVocalEcho()
  let playDur = Math.max(0.05, buffer.duration - offset)
  if (until != null) playDur = Math.max(0.05, Math.min(playDur, until - offset))
  const src = ctx.createBufferSource()
  src.buffer = buffer

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = Math.max(40, role.hp + tone.hp)

  const mud = ctx.createBiquadFilter()
  mud.type = 'peaking'
  mud.frequency.value = 240
  mud.Q.value = 0.7
  mud.gain.value = tone.mud

  const deEss = ctx.createBiquadFilter()
  deEss.type = 'peaking'
  deEss.frequency.value = 6800
  deEss.Q.value = 2.2
  deEss.gain.value = tone.deess

  const compress = role.compress + tone.compress
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -20 - compress * 8
  comp.ratio.value = 3.2 + compress * 4.5
  comp.attack.value = layer.vocalTone === 'studio' ? 0.004 : 0.01
  comp.release.value = layer.vocalTone === 'studio' ? 0.12 : 0.2
  comp.knee.value = 6

  const makeup = ctx.createGain()
  makeup.gain.value = 1 + compress * 0.35

  const eq = applyEq(ctx, makeup, {
    low: -0.8,
    mid: tone.mud > 0 ? 0.4 : -0.2,
    presence: role.presence + tone.presence,
    air: role.air + tone.air,
  })

  src.connect(hp)
  hp.connect(mud)
  mud.connect(deEss)
  deEss.connect(comp)
  comp.connect(makeup)

  let shaped: AudioNode = eq
  if (tone.sat > 0.05) {
    const sat = saturator(ctx, tone.sat)
    const satMix = ctx.createGain()
    satMix.gain.value = 0.85
    eq.connect(sat)
    sat.connect(satMix)
    shaped = satMix
  }
  if (tone.lp) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = tone.lp
    lp.Q.value = 0.7
    shaped.connect(lp)
    shaped = lp
  }

  const merger = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = verb === 'dry' && echo === 'off' ? 1 : 0.92
  shaped.connect(dry)
  dry.connect(merger)
  connectReverb(ctx, shaped, merger, verb)
  connectEcho(ctx, shaped, merger, echo, bpm)

  if (role.width > 0.08) {
    const doubled = ctx.createBufferSource()
    doubled.buffer = buffer
    doubled.detune.value = layer.vocalRole === 'harmony' ? 38 : 11
    const dg = ctx.createGain()
    dg.gain.value = role.width * 0.5
    const pan = ctx.createStereoPanner()
    pan.pan.value = layer.vocalRole === 'double' ? 0.65 : -0.42
    doubled.connect(dg)
    dg.connect(pan)
    pan.connect(merger)
    doubled.start(when, offset)
    doubled.stop(when + playDur + 0.05)
  }

  src.start(when, offset)
  src.stop(when + playDur + 0.05)
  return merger
}

export function masterChain(
  ctx: BaseAudioContext,
  master: MasterSettings,
): { input: AudioNode; output: AudioNode } {
  const input = ctx.createGain()
  input.gain.value = dbToGain(master.inputGain)

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 28

  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 110
  low.gain.value = master.low

  const presence = ctx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 2800
  presence.Q.value = 0.9
  presence.gain.value = master.presence

  const high = ctx.createBiquadFilter()
  high.type = 'highshelf'
  high.frequency.value = 8500
  high.gain.value = master.high

  const glue = ctx.createDynamicsCompressor()
  glue.threshold.value = -18 + (1 - master.glue) * 10
  glue.ratio.value = 1.5 + master.glue * 3
  glue.attack.value = 0.02
  glue.release.value = 0.25
  glue.knee.value = 8

  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -1.2 - master.limiter * 0.5
  limiter.ratio.value = 20
  limiter.attack.value = 0.002
  limiter.release.value = 0.08
  limiter.knee.value = 0.3

  input.connect(hp)
  hp.connect(low)
  low.connect(presence)
  presence.connect(high)
  high.connect(glue)
  glue.connect(limiter)

  return { input, output: limiter }
}

export function autoEqFromBuffer(buffer: AudioBuffer): Pick<MasterSettings, 'low' | 'high' | 'presence'> {
  const data = buffer.getChannelData(0)
  const sr = buffer.sampleRate
  const hop = Math.floor(sr * 0.02)
  let bass = 0
  let mids = 0
  let treble = 0
  let count = 0

  for (let i = 0; i + hop < data.length; i += hop * 4) {
    let s = 0
    let z = 0
    let prev = 0
    for (let j = 0; j < hop; j++) {
      const x = data[i + j]
      s += x * x
      if (prev * x < 0) z++
      prev = x
    }
    const rms = s / hop
    const zc = ((z / hop) * sr) / 2
    if (zc < 250) bass += rms
    else if (zc < 2500) mids += rms
    else treble += rms
    count++
  }

  const n = Math.max(1, count)
  bass /= n
  mids /= n
  treble /= n
  const max = Math.max(bass, mids, treble, 1e-8)
  return {
    low: bass / max > 0.7 ? -2.5 : bass / max < 0.25 ? 2 : 0.4,
    presence: mids / max < 0.3 ? 2.2 : mids / max > 0.75 ? -1.5 : 0.8,
    high: treble / max < 0.25 ? 2.8 : treble / max > 0.7 ? -1.2 : 1.2,
  }
}
