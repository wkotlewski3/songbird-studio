import { instrumentsFor, instrumentById, INSTRUMENTS, SOUNDFONT_CREDIT } from '../data/instruments'
import { DRUM_PIECES, DRUM_PIECE_LABELS, RHYTHM_FEELS, layerHasContent, sameRhythm, type VocalRole } from '../types'
import { useStudio } from '../state/session'
import { getLayerAnalysis, getLayerBuffer, preloadInstrument, setLayerAnalysis, setLayerBuffer } from '../audio/engine'
import { isDirtStyle, resolveDrumSample, samplesForPiece } from '../audio/drumKit'
import { analyzeDrums, quantizeDrums } from '../audio/drums'
import { lockMidiToClick, lockTakeToClick } from '../audio/clickLock'
import { phraseLength, sharedPhraseSeconds } from '../audio/grid'
import { prepareForLoop } from '../audio/loopPrep'
import { analyzeMelody, quantizeNotes } from '../audio/melody'
import { barDuration } from '../audio/metronome'
import { revoiceLayer } from '../audio/revoice'

const ROLES: { id: VocalRole; label: string; hint: string }[] = [
  { id: 'lead', label: 'Lead', hint: 'Front of the mix' },
  { id: 'verse', label: 'Verse', hint: 'Close and dry' },
  { id: 'chorus', label: 'Chorus', hint: 'Wide stack' },
  { id: 'double', label: 'Double', hint: 'Offset companion' },
  { id: 'harmony', label: 'Harmony', hint: 'Lifted air' },
]

function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-mute">
      {label}
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-mist">
        {step < 0.01 ? value.toFixed(3) : step < 0.1 ? value.toFixed(2) : value.toFixed(1)}
      </span>
    </label>
  )
}

function nameForSound(current: string, label: string): string {
  if (current.startsWith('Layer')) return label
  if (INSTRUMENTS.some((inst) => inst.label === current)) return label
  return current
}

export function Inspector() {
  const {
    session,
    selected,
    selectedLayer,
    setSession,
    updateTrack,
    updateLayer,
    addSoundFromTake,
    reuseTake,
    removeLayer,
    selectLayer,
    notify,
  } = useStudio()
  if (!selected || !selectedLayer) {
    return (
      <aside className="hidden w-80 border-l border-line bg-panel p-5 text-sm text-mute lg:block">
        Record or drop a take anytime. Change this layer’s sound here before or after.
      </aside>
    )
  }

  const layer = selectedLayer
  const insts = instrumentsFor(selected.kind)
  const hasTake = layerHasContent(layer)
  const stackedTakes = session.tracks.reduce(
    (n, t) => n + t.layers.filter(layerHasContent).length,
    0,
  )
  const takes = selected.layers.filter((l) => l.id !== layer.id && layerHasContent(l))
  const patch = (p: Parameters<typeof updateLayer>[2]) => updateLayer(selected.id, layer.id, p)
  const analysis = getLayerAnalysis(layer.id)

  const applyRead = (patchSettings: Partial<typeof layer.transcribe>) => {
    const transcribe = { ...layer.transcribe, ...patchSettings }
    patch(revoiceLayer(layer, selected.kind, transcribe, session.meta.bpm))
  }

  const addAs = (instrumentId: string, label: string) => {
    const copy = addSoundFromTake(selected.id, layer.id, instrumentId)
    if (copy) {
      void preloadInstrument(instrumentId)
      selectLayer(selected.id, copy.id)
      notify(`Stacked ${label} on a new layer. × that layer anytime — this one still plays ${instrumentById(layer.instrumentId).label}.`)
    }
  }

  const chooseSound = (instrumentId: string) => {
    const inst = instrumentById(instrumentId)
    patch({
      instrumentId: inst.id,
      drumVoices: {},
      name: nameForSound(layer.name, inst.label),
      accepted: true,
      originalMix: selected.kind === 'vocals' ? layer.originalMix : 0,
      vocalRole:
        inst.id === 'vocal-verse' ? 'verse' : inst.id === 'vocal-chorus' ? 'chorus' : layer.vocalRole,
    })
    void preloadInstrument(inst.id)
    notify(
      hasTake
        ? `This layer now plays ${inst.label}. Recorded audio stays — only the voice changed.`
        : `${inst.label} is ready. Record or drop a take onto this layer whenever you want.`,
    )
  }

  const syncAllLayers = () => {
    const bpm = session.meta.bpm
    const items = session.tracks.flatMap((t) =>
      t.layers.filter(layerHasContent).map((l) => ({ track: t, layer: l })),
    )
    if (items.length < 2) {
      notify('Add another take first — sync puts every layer on the same click.')
      return
    }
    const loopSeconds = sharedPhraseSeconds(
      items.map((item) => item.layer.duration),
      bpm,
      session.meta.bars,
    )
    const bars = Math.max(1, Math.round(loopSeconds / barDuration(bpm)))
    const patches = new Map<string, Partial<typeof layer>>()
    for (const { track, layer: item } of items) {
      if (track.kind === 'vocals') {
        const buf = getLayerBuffer(item.id)
        if (!buf) continue
        const prepared = prepareForLoop(buf, bpm, loopSeconds)
        setLayerBuffer(item.id, prepared.buffer)
        patches.set(item.id, {
          duration: prepared.seconds,
          status: `In sync · ${prepared.bars} bars`,
        })
        continue
      }
      const buf = getLayerBuffer(item.id)
      if (buf) {
        const locked = lockTakeToClick({
          buffer: buf,
          notes: item.notes,
          drums: item.drums,
          bpm,
          loopSeconds,
          followSession: true,
        })
        setLayerBuffer(item.id, locked.buffer)
        if (track.kind === 'drums') {
          setLayerAnalysis(item.id, { kind: 'drums', drums: analyzeDrums(locked.buffer) })
        }
        if (track.kind === 'melody') {
          setLayerAnalysis(item.id, { kind: 'melody', melody: analyzeMelody(locked.buffer) })
        }
        patches.set(item.id, {
          notes: locked.notes,
          drums: locked.drums,
          rhythm: locked.feel,
          quantize: 1,
          duration: locked.seconds,
          status: `In sync · ${locked.feel.label}`,
        })
      } else {
        const locked = lockMidiToClick(item.notes, item.drums, bpm, loopSeconds, item.rhythm, true)
        patches.set(item.id, {
          notes: locked.notes,
          drums: locked.drums,
          rhythm: locked.feel,
          quantize: 1,
          duration: loopSeconds,
          status: `In sync · ${locked.feel.label}`,
        })
      }
    }
    setSession((s) => ({
      ...s,
      meta: { ...s.meta, bars },
      tracks: s.tracks.map((t) => ({
        ...t,
        layers: t.layers.map((l) => (patches.has(l.id) ? { ...l, ...patches.get(l.id) } : l)),
      })),
    }))
    notify('Every layer is on the same click — same loop, same beats.')
  }

  return (
    <aside className="w-full overflow-auto border-l border-line bg-panel p-5 lg:w-80">
      <p className="text-xs uppercase tracking-widest text-mute">Inspector</p>
      <input
        value={selected.name}
        onChange={(e) => updateTrack(selected.id, { name: e.target.value })}
        className="mt-3 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
      />
      <input
        value={layer.name}
        onChange={(e) => patch({ name: e.target.value })}
        className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-mist outline-none focus:border-gold"
      />
      {selected.layers.length > 1 && (
        <div className="mt-3 rounded-2xl border border-line p-3">
          <p className="text-xs uppercase tracking-widest text-gold">Layers on this track</p>
          <p className="mt-1 text-[11px] text-mute">Each can be a different kit or instrument. × removes it from the stack.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {selected.layers.map((item) => (
              <li key={item.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectLayer(selected.id, item.id)}
                  className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left text-xs ${
                    item.id === layer.id ? 'bg-ink text-gold ring-1 ring-gold' : 'text-mist hover:text-white'
                  }`}
                >
                  <span className="block truncate">{item.name}</span>
                  <span className="block truncate text-[10px] text-mute">
                    {instrumentById(item.instrumentId).label}
                    {layerHasContent(item) ? '' : ' · empty'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeLayer(selected.id, item.id)
                    notify(`Removed ${item.name}.`)
                  }}
                  className="shrink-0 px-2 text-mute hover:text-drums"
                  title="Remove this layer"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-xs uppercase tracking-widest text-gold">
        {selected.kind === 'vocals' ? 'This layer’s treatment' : 'Sound on this layer'}
      </p>
      <p className="mt-1 text-[11px] text-mute">
        Swap anytime — before or after you record. This changes the voice on the selected layer, not a new one.
      </p>
      <p className="mt-2 text-xs text-mist">
        Playing <span className="text-gold">{instrumentById(layer.instrumentId).label}</span>
      </p>
      <div className="mt-2 grid gap-2">
        {insts.map((inst) => (
          <button
            key={inst.id}
            type="button"
            onClick={() => chooseSound(inst.id)}
            className={`rounded-2xl border px-3 py-2 text-left ${
              layer.instrumentId === inst.id ? 'border-gold bg-ink' : 'border-line'
            }`}
          >
            <p className="text-sm text-white">{inst.label}</p>
            <p className="text-[11px] text-mute">{inst.blurb}</p>
          </button>
        ))}
      </div>
      {selected.kind === 'drums' && isDirtStyle(layer.instrumentId) && (
        <div className="mt-4 rounded-2xl border border-line p-3">
          <p className="text-xs uppercase tracking-widest text-gold">Piece sounds</p>
          <p className="mt-1 text-[11px] text-mute">
            Swap individual hits on this layer — clap, 808 kick, Gretsch snare — without adding another strip.
          </p>
          <div className="mt-2 grid gap-2">
            {DRUM_PIECES.map((piece) => {
              const current = resolveDrumSample(layer.instrumentId, piece, layer.drumVoices) ?? ''
              return (
                <label key={piece} className="flex flex-col gap-1 text-[11px] text-mute">
                  {DRUM_PIECE_LABELS[piece]}
                  <select
                    className="rounded-xl border border-line bg-ink px-2 py-1.5 text-xs text-white outline-none focus:border-gold"
                    value={current}
                    onChange={(e) => {
                      const drumVoices = { ...layer.drumVoices, [piece]: e.target.value }
                      patch({ drumVoices })
                      void preloadInstrument(layer.instrumentId, drumVoices)
                    }}
                  >
                    {samplesForPiece(piece).map((sample) => (
                      <option key={sample.id} value={sample.id}>
                        {sample.label}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        </div>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-mute">{SOUNDFONT_CREDIT}</p>

      {hasTake && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-mute">Stack another layer</p>
          <p className="mt-1 text-[11px] text-mute">
            Same take, extra strip — e.g. 808 under Tidal. Remove it with × on the layer list above.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {insts.map((inst) => (
              <button
                key={`add-${inst.id}`}
                type="button"
                onClick={() => addAs(inst.id, inst.label)}
                className="rounded-full border border-line px-3 py-1 text-xs text-mist hover:border-gold hover:text-gold"
              >
                + {inst.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected.kind !== 'vocals' && hasTake && (
        <div className="mt-4 rounded-2xl border border-line p-3">
          <p className="text-xs uppercase tracking-widest text-gold">Original vs MIDI</p>
          <p className="mt-1 text-[11px] text-mute">
            Interpretation only plays the guitar, piano, or kit. Drag toward original if you want the recording in the
            blend.
          </p>
          <label className="mt-2 flex flex-col gap-1 text-[11px] text-mute">
            Keep original
            <input
              type="range"
              className="slider"
              min={0}
              max={1}
              step={0.05}
              value={layer.originalMix}
              onChange={(e) => patch({ originalMix: Number(e.target.value) })}
            />
            <span>
              {layer.originalMix < 0.1
                ? 'Interpretation only — changing the sound revoices this take'
                : layer.originalMix > 0.9
                  ? 'Uploaded audio only — pick a sound to hear MIDI again'
                  : 'Blend of your take and the MIDI'}
            </span>
          </label>
          <button
            onClick={() =>
              patch({
                reviewing: true,
                accepted: false,
                status: 'Reviewing transcription',
              })
            }
            className="mt-3 w-full rounded-full border border-line py-1.5 text-xs text-mist hover:border-gold"
          >
            Review thresholds again
          </button>
        </div>
      )}

      {selected.kind !== 'vocals' && hasTake && analysis && (
        <div className="mt-4 rounded-2xl border border-line p-3">
          <p className="text-xs uppercase tracking-widest text-gold">Read this take again</p>
          <p className="mt-1 text-[11px] text-mute">
            These sliders rewrite the MIDI from the same recording. Piano roll and kit update while you drag.
          </p>
          <div className="mt-2 grid gap-2">
            {selected.kind === 'drums' ? (
              <>
                <Knob
                  label="Onset"
                  value={layer.transcribe.onset}
                  min={0.25}
                  max={2.2}
                  step={0.05}
                  onChange={(onset) => applyRead({ onset })}
                />
                <Knob
                  label="Shortest gap"
                  value={layer.transcribe.minNote}
                  min={0.03}
                  max={0.14}
                  step={0.005}
                  onChange={(minNote) => applyRead({ minNote })}
                />
              </>
            ) : (
              <>
                <Knob
                  label="Gate"
                  value={layer.transcribe.gate}
                  min={0.002}
                  max={0.06}
                  step={0.001}
                  onChange={(gate) => applyRead({ gate })}
                />
                <Knob
                  label="Confidence"
                  value={layer.transcribe.confidence}
                  min={0.4}
                  max={0.9}
                  step={0.01}
                  onChange={(confidence) => applyRead({ confidence })}
                />
                <Knob
                  label="Pitch snap"
                  value={layer.transcribe.snap}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(snap) => applyRead({ snap })}
                />
              </>
            )}
          </div>
        </div>
      )}

      {!hasTake && takes.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-gold">Use an uploaded take</p>
          <p className="mt-1 text-[11px] text-mute">Put that audio on this layer, then change the sound above anytime.</p>
          <div className="mt-2 grid gap-2">
            {takes.map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => {
                  reuseTake(selected.id, layer.id, src.id)
                  notify(`This layer now uses the same audio as ${src.name}.`)
                }}
                className="rounded-2xl border border-line px-3 py-2 text-left text-sm text-white hover:border-gold"
              >
                {src.name}
                <span className="mt-0.5 block text-[11px] text-mute">
                  {instrumentById(src.instrumentId).label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected.kind === 'vocals' && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-widest text-mute">Vocal role</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => patch({ vocalRole: r.id })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  layer.vocalRole === r.id ? 'border-gold text-gold' : 'border-line text-mist'
                }`}
                title={r.hint}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Knob label="Gain dB" value={layer.gain} min={-18} max={12} step={0.5} onChange={(gain) => patch({ gain })} />
        <Knob label="Pan" value={layer.pan} min={-1} max={1} step={0.05} onChange={(pan) => patch({ pan })} />
        <Knob label="Low" value={layer.eq.low} min={-8} max={8} step={0.5} onChange={(low) => patch({ eq: { ...layer.eq, low } })} />
        <Knob label="Mid" value={layer.eq.mid} min={-8} max={8} step={0.5} onChange={(mid) => patch({ eq: { ...layer.eq, mid } })} />
        <Knob
          label="Presence"
          value={layer.eq.presence}
          min={-8}
          max={8}
          step={0.5}
          onChange={(presence) => patch({ eq: { ...layer.eq, presence } })}
        />
        <Knob label="Air" value={layer.eq.air} min={-8} max={8} step={0.5} onChange={(air) => patch({ eq: { ...layer.eq, air } })} />
        <Knob
          label="Snap to click"
          value={layer.quantize}
          min={0}
          max={1}
          step={0.05}
          onChange={(quantize) => patch({ quantize })}
        />
      </div>
      {selected.kind !== 'vocals' && hasTake && (
        <>
          <p className="mt-4 text-xs uppercase tracking-widest text-mute">Groove on this take</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RHYTHM_FEELS.map((feel) => (
              <button
                key={feel.label}
                type="button"
                onClick={() => {
                  patch({
                    rhythm: feel,
                    notes: quantizeNotes(layer.notes, session.meta.bpm, 1, feel.slotsPerBeat),
                    drums: quantizeDrums(layer.drums, session.meta.bpm, 1, feel.slotsPerBeat),
                    quantize: 1,
                    status: `Feel · ${feel.label}`,
                  })
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  sameRhythm(layer.rhythm, feel) ? 'border-gold text-gold' : 'border-line text-mist'
                }`}
              >
                {feel.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const bpm = session.meta.bpm
              const others = session.tracks.flatMap((t) => t.layers.filter(layerHasContent))
              const loopLen =
                others.length > 1
                  ? sharedPhraseSeconds(
                      others.map((l) => l.duration),
                      bpm,
                      session.meta.bars,
                    )
                  : phraseLength(layer.duration, bpm)
              const buf = getLayerBuffer(layer.id)
              if (!buf) {
                const locked = lockMidiToClick(
                  layer.notes,
                  layer.drums,
                  bpm,
                  loopLen,
                  undefined,
                  others.length > 1,
                )
                patch({
                  notes: locked.notes,
                  drums: locked.drums,
                  rhythm: locked.feel,
                  quantize: 1,
                  status: `Locked to the click · ${locked.feel.label}`,
                })
                notify(`Locked as ${locked.feel.label} — pulse stretched onto this BPM, first hit on beat 1.`)
                return
              }
              const locked = lockTakeToClick({
                buffer: buf,
                notes: layer.notes,
                drums: layer.drums,
                bpm,
                loopSeconds: loopLen,
                followSession: others.length > 1,
              })
              setLayerBuffer(layer.id, locked.buffer)
              if (selected.kind === 'drums') {
                setLayerAnalysis(layer.id, { kind: 'drums', drums: analyzeDrums(locked.buffer) })
              }
              if (selected.kind === 'melody') {
                setLayerAnalysis(layer.id, { kind: 'melody', melody: analyzeMelody(locked.buffer) })
              }
              patch({
                notes: locked.notes,
                drums: locked.drums,
                rhythm: locked.feel,
                quantize: 1,
                duration: locked.seconds,
                status: `Locked to the click · ${locked.feel.label}`,
              })
              notify(`Locked as ${locked.feel.label} — pulse stretched onto this BPM, first hit on beat 1.`)
            }}
            className="mt-3 w-full rounded-full border border-gold/70 py-1.5 text-xs text-gold hover:bg-gold/10"
          >
            Lock to click
          </button>
        </>
      )}
      {stackedTakes >= 2 && (
        <button
          type="button"
          onClick={syncAllLayers}
          className="mt-3 w-full rounded-full border border-gold bg-gold/10 py-1.5 text-xs text-gold hover:bg-gold/20"
        >
          Make layers in sync
        </button>
      )}
      <p className="mt-2 text-[11px] text-mute">
        Takes lock to the click by default — even if you recorded with it muted. SongBird picks the closest groove
        (quarters vs 8ths vs 16ths, 4/4 vs 3/4) then stretches the pulse onto this BPM. Snap to click is how hard
        notes hug that grid. Make layers in sync puts every take on the same loop and beat 1 so two layers cannot
        drift. Lock to click runs the stretch again on this take if it still feels off.
      </p>
    </aside>
  )
}
