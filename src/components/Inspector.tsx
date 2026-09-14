import { instrumentsFor, instrumentById, SOUNDFONT_CREDIT } from '../data/instruments'
import { DRUM_PIECES, DRUM_PIECE_LABELS, layerHasContent, takeIdOf, type VocalRole } from '../types'
import { useStudio } from '../state/session'
import { getLayerAnalysis, preloadInstrument } from '../audio/engine'
import { isDirtStyle, resolveDrumSample, samplesForPiece } from '../audio/drumKit'
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

export function Inspector() {
  const { selected, selectedLayer, updateTrack, updateLayer, addSoundFromTake, reuseTake, notify } =
    useStudio()
  if (!selected || !selectedLayer) {
    return (
      <aside className="hidden w-80 border-l border-line bg-panel p-5 text-sm text-mute lg:block">
        Record live or drop a raw file — then pick sounds, EQ, and vocal roles here.
      </aside>
    )
  }

  const layer = selectedLayer
  const insts = instrumentsFor(selected.kind)
  const hasTake = layerHasContent(layer)
  const takes = selected.layers.filter((l) => l.id !== layer.id && layerHasContent(l))
  const patch = (p: Parameters<typeof updateLayer>[2]) => updateLayer(selected.id, layer.id, p)
  const siblings = selected.layers.filter((l) => takeIdOf(l) === takeIdOf(layer))
  const analysis = getLayerAnalysis(layer.id)

  const applyRead = (patchSettings: Partial<typeof layer.transcribe>) => {
    const transcribe = { ...layer.transcribe, ...patchSettings }
    patch(revoiceLayer(layer, selected.kind, transcribe))
  }

  const addAs = (instrumentId: string, label: string) => {
    const copy = addSoundFromTake(selected.id, layer.id, instrumentId)
    if (copy) {
      void preloadInstrument(instrumentId)
      notify(`Added ${label} from this same audio. Hit Play to hear the stack.`)
    }
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
      {hasTake && siblings.length > 1 && (
        <p className="mt-2 text-[11px] text-gold">
          This take is on {siblings.length} layers: {siblings.map((l) => instrumentById(l.instrumentId).label).join(', ')}
        </p>
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

      {hasTake && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-gold">Add this audio as</p>
          <p className="mt-1 text-[11px] text-mute">Same take, new layer. No re-upload.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {insts.map((inst) => (
              <button
                key={`add-${inst.id}`}
                onClick={() => addAs(inst.id, inst.label)}
                className="rounded-full border border-line px-3 py-1 text-xs text-mist hover:border-gold hover:text-gold"
              >
                + {inst.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasTake && takes.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-gold">Use an uploaded take</p>
          <p className="mt-1 text-[11px] text-mute">Put that audio on this layer, then pick a sound.</p>
          <div className="mt-2 grid gap-2">
            {takes.map((src) => (
              <button
                key={src.id}
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

      <p className="mt-5 text-xs uppercase tracking-widest text-mute">
        {selected.kind === 'vocals' ? 'This layer’s treatment' : 'This layer’s sound'}
      </p>
      <div className="mt-2 grid gap-2">
        {insts.map((inst) => (
          <button
            key={inst.id}
            onClick={() => {
              patch({
                instrumentId: inst.id,
                drumVoices: {},
                name: layer.name.startsWith('Layer') ? inst.label : layer.name,
                accepted: true,
                originalMix: selected.kind === 'vocals' ? layer.originalMix : 0,
                vocalRole:
                  inst.id === 'vocal-verse'
                    ? 'verse'
                    : inst.id === 'vocal-chorus'
                      ? 'chorus'
                      : layer.vocalRole,
              })
              void preloadInstrument(inst.id)
            }}
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
            Open Dirt-Samples hits — pick a clap, rim, 808 kick, Gretsch snare, not only a whole kit.
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
          label="Snap to grid"
          value={layer.quantize}
          min={0}
          max={1}
          step={0.05}
          onChange={(quantize) => patch({ quantize })}
        />
      </div>
      <p className="mt-2 text-[11px] text-mute">
        Snap to grid is timing. Gate, confidence, and onset change which notes and hits are read from your take.
        Pick a sound above to revoice this strip — use <span className="text-gold">Add this audio as</span> to stack
        another instrument without another upload.
      </p>
    </aside>
  )
}
