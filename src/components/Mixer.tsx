import { instrumentById } from '../data/instruments'
import type { Layer, Track } from '../types'
import { useStudio } from '../state/session'
import { MixVisualizer, Visualizer, visColor } from './Visualizer'

const KIND: Record<Track['kind'], string> = {
  melody: 'bg-melody',
  drums: 'bg-drums',
  vocals: 'bg-vocals',
}

function Fader({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="range"
      min={-18}
      max={12}
      step={0.5}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="slider w-full"
      aria-label="Volume"
    />
  )
}

function MS({
  muted,
  solo,
  onMute,
  onSolo,
}: {
  muted: boolean
  solo: boolean
  onMute: () => void
  onSolo: () => void
}) {
  return (
    <div className="flex gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onMute()
        }}
        className={`h-6 w-6 rounded text-[10px] font-semibold ${muted ? 'bg-drums text-ink' : 'border border-line text-mute'}`}
        title="Mute"
      >
        M
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSolo()
        }}
        className={`h-6 w-6 rounded text-[10px] font-semibold ${solo ? 'bg-gold text-ink' : 'border border-line text-mute'}`}
        title="Solo / isolate"
      >
        S
      </button>
    </div>
  )
}

function LayerRow({ track, layer }: { track: Track; layer: Layer }) {
  const { selectedLayer, selectLayer, updateLayer, updateTrack, removeLayer } = useStudio()
  const active = selectedLayer?.id === layer.id
  return (
    <div
      onClick={() => selectLayer(track.id, layer.id)}
      className={`w-full rounded-xl border px-2 py-2 text-left ${active ? 'border-gold bg-ink' : 'border-line/70 bg-ink/40'}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-white">{layer.name}</p>
          <p className="truncate text-[10px] text-mute">{instrumentById(layer.instrumentId).label}</p>
          {layer.sourceId && layer.sourceId !== layer.id && (
            <p className="text-[10px] text-gold">same take</p>
          )}
        </div>
        {track.layers.length > 1 && (
          <span
            role="button"
            className="text-mute hover:text-drums"
            onClick={(e) => {
              e.stopPropagation()
              removeLayer(track.id, layer.id)
            }}
          >
            ×
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <MS
          muted={layer.muted}
          solo={layer.solo}
          onMute={() => updateLayer(track.id, layer.id, { muted: !layer.muted })}
          onSolo={() => {
            if (track.muted) updateTrack(track.id, { muted: false })
            updateLayer(track.id, layer.id, { solo: !layer.solo })
          }}
        />
        <Fader value={layer.gain} onChange={(gain) => updateLayer(track.id, layer.id, { gain })} />
      </div>
      <div className="pointer-events-none mt-2">
        <Visualizer layerId={layer.id} color={visColor[track.kind]} variant="strip" />
      </div>
    </div>
  )
}

export function Mixer({ onExport, onVideo }: { onExport: () => void; onVideo?: () => void }) {
  const { session, selected, select, updateTrack, addLayer, stackLayer, selectedLayer, notify, setSession } =
    useStudio()

  return (
    <section className="border-t border-line bg-panel">
      <div className="flex items-center justify-between px-5 pt-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-mute">Mixer</p>
          <p className="font-display text-lg text-white">All players — live mix on the left, each layer on its strip</p>
        </div>
      </div>
      {session.tracks.length > 0 && (
        <div className="px-5 pt-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-gold">Playing together</p>
          <MixVisualizer tracks={session.tracks} />
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto px-5 py-4">
        {session.tracks.map((track) => (
          <div
            key={track.id}
            onClick={() => select(track.id)}
            className={`flex w-44 shrink-0 flex-col gap-2 rounded-2xl border p-3 ${
              selected?.id === track.id ? 'border-gold bg-panel-2' : 'border-line bg-ink/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${KIND[track.kind]}`} />
              <input
                value={track.name}
                onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                className="w-full bg-transparent text-sm text-white outline-none"
              />
            </div>
            <MS
              muted={track.muted}
              solo={track.solo}
              onMute={() => updateTrack(track.id, { muted: !track.muted })}
              onSolo={() => updateTrack(track.id, { solo: !track.solo })}
            />
            <div className="flex flex-col gap-2">
              {track.layers.map((layer) => (
                <LayerRow key={layer.id} track={track} layer={layer} />
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Fader value={track.gain} onChange={(gain) => updateTrack(track.id, { gain })} />
              <p className="text-center text-[10px] text-mute">{track.gain.toFixed(1)} dB</p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  addLayer(track.id)
                  notify('Empty layer added. Reuse an uploaded take from the inspector, or record a new one.')
                }}
                className="rounded-full border border-line py-1 text-[11px] text-mist hover:border-gold"
              >
                + Layer
              </button>
              {selectedLayer && selected?.id === track.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const copy = stackLayer(track.id, selectedLayer.id)
                    if (copy) notify('Copied this take to a new layer. Assign it a different sound in the inspector.')
                  }}
                  className="rounded-full border border-line py-1 text-[11px] text-mist hover:border-gold"
                >
                  Copy take
                </button>
              )}
            </div>
          </div>
        ))}

        <MasterStrip onExport={onExport} onVideo={onVideo} setSession={setSession} session={session} notify={notify} />
      </div>
    </section>
  )
}

function MasterStrip({
  onExport,
  onVideo,
  session,
  setSession,
  notify,
}: {
  onExport: () => void
  onVideo?: () => void
  session: ReturnType<typeof useStudio>['session']
  setSession: ReturnType<typeof useStudio>['setSession']
  notify: (m: string) => void
}) {
  const m = session.master
  const set = (patch: Partial<typeof m>) => setSession({ ...session, master: { ...m, ...patch } })
  return (
    <div className="flex w-52 shrink-0 flex-col gap-3 rounded-2xl border border-gold/40 bg-ink p-3">
      <p className="text-xs uppercase tracking-widest text-gold">Master</p>
      {(
        [
          ['Input', 'inputGain', -6, 8],
          ['Low', 'low', -6, 6],
          ['Presence', 'presence', -6, 6],
          ['Air', 'high', -6, 6],
          ['Glue', 'glue', 0, 1],
          ['Limit', 'limiter', 0, 1],
        ] as const
      ).map(([label, key, min, max]) => (
        <label key={key} className="flex flex-col gap-1 text-[10px] text-mute">
          {label}
          <input
            type="range"
            className="slider"
            min={min}
            max={max}
            step={0.1}
            value={m[key]}
            onChange={(e) => set({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <button
        onClick={() => {
          set({ autoEq: true, presence: 1.5, high: 1.8, low: 0.3, glue: 0.7, limiter: 0.95 })
          notify('Master bus: EQ + glue + limiter. Hit Play to hear the stack.')
        }}
        className="rounded-full border border-line py-1.5 text-[11px] text-mist hover:border-gold"
      >
        Fix EQ + master
      </button>
      <button
        type="button"
        onClick={onVideo}
        className="rounded-full border border-gold/70 py-1.5 text-[11px] text-gold hover:bg-gold/10"
      >
        Music video
      </button>
      <button onClick={onExport} className="rounded-full bg-gold py-1.5 text-[11px] font-medium text-ink">
        Export
      </button>
    </div>
  )
}
