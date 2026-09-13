import { instrumentsFor, instrumentById, SOUNDFONT_CREDIT } from '../data/instruments'
import type { VocalRole } from '../types'
import { useStudio } from '../state/session'
import { preloadInstrument } from '../audio/engine'

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
      <span className="text-mist">{value.toFixed(1)}</span>
    </label>
  )
}

export function Inspector() {
  const { selected, updateTrack } = useStudio()
  if (!selected) {
    return (
      <aside className="hidden w-80 border-l border-line bg-panel p-5 text-sm text-mute lg:block">
        Select a track to pick sounds, EQ, and vocal roles.
      </aside>
    )
  }

  const insts = instrumentsFor(selected.kind)

  return (
    <aside className="w-full overflow-auto border-l border-line bg-panel p-5 lg:w-80">
      <p className="text-xs uppercase tracking-widest text-mute">Inspector</p>
      <input
        value={selected.name}
        onChange={(e) => updateTrack(selected.id, { name: e.target.value })}
        className="mt-3 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
      />

      <p className="mt-5 text-xs uppercase tracking-widest text-mute">
        {selected.kind === 'vocals' ? 'Treatment' : 'Open-source sound'}
      </p>
      <div className="mt-2 grid gap-2">
        {insts.map((inst) => (
          <button
            key={inst.id}
            onClick={() => {
              updateTrack(selected.id, {
                instrumentId: inst.id,
                vocalRole:
                  inst.id === 'vocal-verse'
                    ? 'verse'
                    : inst.id === 'vocal-chorus'
                      ? 'chorus'
                      : selected.vocalRole,
              })
              void preloadInstrument(inst.id)
            }}
            className={`rounded-2xl border px-3 py-2 text-left ${
              selected.instrumentId === inst.id ? 'border-gold bg-ink' : 'border-line'
            }`}
          >
            <p className="text-sm text-white">{inst.label}</p>
            <p className="text-[11px] text-mute">{inst.blurb}</p>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-mute">{SOUNDFONT_CREDIT}</p>

      {selected.kind === 'vocals' && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-widest text-mute">Vocal role</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => updateTrack(selected.id, { vocalRole: r.id })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selected.vocalRole === r.id ? 'border-gold text-gold' : 'border-line text-mist'
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
        <Knob
          label="Gain dB"
          value={selected.gain}
          min={-18}
          max={12}
          step={0.5}
          onChange={(gain) => updateTrack(selected.id, { gain })}
        />
        <Knob
          label="Pan"
          value={selected.pan}
          min={-1}
          max={1}
          step={0.05}
          onChange={(pan) => updateTrack(selected.id, { pan })}
        />
        <Knob
          label="Low"
          value={selected.eq.low}
          min={-8}
          max={8}
          step={0.5}
          onChange={(low) => updateTrack(selected.id, { eq: { ...selected.eq, low } })}
        />
        <Knob
          label="Mid"
          value={selected.eq.mid}
          min={-8}
          max={8}
          step={0.5}
          onChange={(mid) => updateTrack(selected.id, { eq: { ...selected.eq, mid } })}
        />
        <Knob
          label="Presence"
          value={selected.eq.presence}
          min={-8}
          max={8}
          step={0.5}
          onChange={(presence) => updateTrack(selected.id, { eq: { ...selected.eq, presence } })}
        />
        <Knob
          label="Air"
          value={selected.eq.air}
          min={-8}
          max={8}
          step={0.5}
          onChange={(air) => updateTrack(selected.id, { eq: { ...selected.eq, air } })}
        />
        <Knob
          label="Snap to grid"
          value={selected.quantize}
          min={0}
          max={1}
          step={0.05}
          onChange={(quantize) => updateTrack(selected.id, { quantize })}
        />
      </div>
      <p className="mt-2 text-[11px] text-mute">
        Snap at 0 keeps the original timing and dynamics — the intention of the take. {instrumentById(selected.instrumentId).label} is
        loaded from open GM samples (or the built-in kit).
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => updateTrack(selected.id, { muted: !selected.muted })}
          className={`rounded-full border px-3 py-1 text-xs ${selected.muted ? 'border-drums text-drums' : 'border-line'}`}
        >
          Mute
        </button>
        <button
          onClick={() => updateTrack(selected.id, { solo: !selected.solo })}
          className={`rounded-full border px-3 py-1 text-xs ${selected.solo ? 'border-gold text-gold' : 'border-line'}`}
        >
          Solo
        </button>
      </div>
    </aside>
  )
}
