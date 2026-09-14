import type { EqState, Layer, MasterSettings, VocalRole } from '../types'
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

const ROLE: Record<
  VocalRole,
  { hp: number; presence: number; air: number; compress: number; wet: number; width: number; delay: number }
> = {
  lead: { hp: 90, presence: 3.5, air: 2, compress: 0.55, wet: 0.18, width: 0.12, delay: 0.09 },
  verse: { hp: 80, presence: 1.5, air: 0.5, compress: 0.4, wet: 0.1, width: 0.04, delay: 0.07 },
  chorus: { hp: 100, presence: 4, air: 3.5, compress: 0.62, wet: 0.3, width: 0.35, delay: 0.12 },
  double: { hp: 110, presence: 2, air: 1.5, compress: 0.5, wet: 0.16, width: 0.45, delay: 0.018 },
  harmony: { hp: 120, presence: 2.5, air: 2.5, compress: 0.5, wet: 0.28, width: 0.4, delay: 0.022 },
}

function makeImpulse(ctx: BaseAudioContext, seconds = 1.65, decay = 2.6): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay
    }
  }
  return buf
}

function plateReverb(ctx: BaseAudioContext): { input: AudioNode; output: AudioNode } {
  const input = ctx.createGain()
  const conv = ctx.createConvolver()
  conv.buffer = makeImpulse(ctx)
  const output = ctx.createGain()
  output.gain.value = 0.85
  const dry = ctx.createGain()
  dry.gain.value = 0.15
  input.connect(conv)
  conv.connect(output)
  input.connect(dry)
  dry.connect(output)
  return { input, output }
}

export function vocalGraph(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  layer: Pick<Layer, 'vocalRole' | 'eq'>,
  when: number,
  offset = 0,
  until?: number,
): AudioNode {
  const role = ROLE[layer.vocalRole]
  let playDur = Math.max(0.05, buffer.duration - offset)
  if (until != null) playDur = Math.max(0.05, Math.min(playDur, until - offset))
  const src = ctx.createBufferSource()
  src.buffer = buffer

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = role.hp

  const deEss = ctx.createBiquadFilter()
  deEss.type = 'peaking'
  deEss.frequency.value = 7200
  deEss.Q.value = 2
  deEss.gain.value = -3.5

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18 - role.compress * 10
  comp.ratio.value = 3 + role.compress * 5
  comp.attack.value = 0.008
  comp.release.value = 0.18

  const eq = applyEq(ctx, comp, {
    low: layer.eq.low - 1,
    mid: layer.eq.mid,
    presence: layer.eq.presence + role.presence,
    air: layer.eq.air + role.air,
  })

  src.connect(hp)
  hp.connect(deEss)
  deEss.connect(comp)

  const merger = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = 1 - role.wet * 0.5
  eq.connect(dry)
  dry.connect(merger)

  const delay = ctx.createDelay(0.4)
  delay.delayTime.value = role.delay
  const delayGain = ctx.createGain()
  delayGain.gain.value = role.wet * 0.45
  eq.connect(delay)
  delay.connect(delayGain)
  delayGain.connect(merger)

  const verb = plateReverb(ctx)
  const verbGain = ctx.createGain()
  verbGain.gain.value = role.wet
  eq.connect(verb.input)
  verb.output.connect(verbGain)
  verbGain.connect(merger)

  if (role.width > 0.05) {
    const doubled = ctx.createBufferSource()
    doubled.buffer = buffer
    doubled.detune.value = layer.vocalRole === 'harmony' ? 38 : 11
    const dg = ctx.createGain()
    dg.gain.value = role.width * 0.55
    const pan = ctx.createStereoPanner()
    pan.pan.value = layer.vocalRole === 'double' ? 0.65 : -0.4
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
