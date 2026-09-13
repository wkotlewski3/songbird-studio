import type { DrumPiece } from '../types'

function noiseBuffer(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

let noise: AudioBuffer | null = null

function getNoise(ctx: BaseAudioContext): AudioBuffer {
  noise ??= noiseBuffer(ctx, 1.5)
  return noise
}

export function playDrumSynth(
  ctx: BaseAudioContext,
  dest: AudioNode,
  piece: DrumPiece,
  time: number,
  velocity: number,
): void {
  const v = velocity / 127
  const g = ctx.createGain()
  g.connect(dest)

  if (piece === 'kick') {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, time)
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12)
    g.gain.setValueAtTime(v * 1.1, time)
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.42)
    osc.connect(g)
    osc.start(time)
    osc.stop(time + 0.45)
    const click = ctx.createOscillator()
    const cg = ctx.createGain()
    click.frequency.value = 980
    cg.gain.setValueAtTime(v * 0.18, time)
    cg.gain.exponentialRampToValueAtTime(0.0001, time + 0.02)
    click.connect(cg)
    cg.connect(dest)
    click.start(time)
    click.stop(time + 0.03)
    return
  }

  if (piece === 'snare' || piece === 'tom') {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(piece === 'tom' ? 140 : 180, time)
    osc.frequency.exponentialRampToValueAtTime(piece === 'tom' ? 90 : 120, time + 0.08)
    const og = ctx.createGain()
    og.gain.setValueAtTime(v * (piece === 'tom' ? 0.7 : 0.35), time)
    og.gain.exponentialRampToValueAtTime(0.0001, time + (piece === 'tom' ? 0.28 : 0.16))
    osc.connect(og)
    og.connect(dest)
    osc.start(time)
    osc.stop(time + 0.3)

    const src = ctx.createBufferSource()
    src.buffer = getNoise(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = piece === 'tom' ? 400 : 1800
    bp.Q.value = piece === 'tom' ? 1.2 : 0.9
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(v * 0.7, time)
    ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.22)
    src.connect(bp)
    bp.connect(ng)
    ng.connect(dest)
    src.start(time)
    src.stop(time + 0.25)
    return
  }

  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = piece === 'crash' ? 4000 : 7000
  const ng = ctx.createGain()
  const dur = piece === 'hatClosed' ? 0.045 : piece === 'crash' ? 1.0 : 0.22
  ng.gain.setValueAtTime(v * (piece === 'crash' ? 0.45 : 0.28), time)
  ng.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  src.connect(hp)
  hp.connect(ng)
  ng.connect(dest)
  src.start(time)
  src.stop(time + dur + 0.02)
}
