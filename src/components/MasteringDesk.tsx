import { autoEqFromBuffer } from '../audio/mix'
import { bounceSession } from '../audio/engine'
import { useStudio } from '../state/session'

export function MasteringDesk({ onExport }: { onExport: () => void }) {
  const { session, setSession, notify } = useStudio()
  const m = session.master

  const set = (patch: Partial<typeof m>) =>
    setSession({ ...session, master: { ...m, ...patch } })

  return (
    <section className="border-t border-line bg-panel px-5 py-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-mute">Master</p>
          <p className="font-display text-xl text-white">Bus</p>
        </div>
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
          <label key={key} className="flex w-24 flex-col gap-1 text-[11px] text-mute">
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
          onClick={async () => {
            notify('Analyzing the mix for a corrective EQ…')
            try {
              const buffer = await bounceSession(session)
              const eq = autoEqFromBuffer(buffer)
              setSession({
                ...session,
                master: { ...session.master, ...eq, autoEq: true, glue: Math.max(session.master.glue, 0.62) },
              })
              notify('EQ fixed and glue engaged. Play it back, then export.')
            } catch {
              set({ autoEq: true, presence: 1.5, high: 1.8, low: 0.3, glue: 0.65 })
              notify('Applied a safe mastering EQ. Bounce failed — try Play first to unlock audio.')
            }
          }}
          className="rounded-full border border-line px-4 py-2 text-xs text-mist hover:border-gold"
        >
          Fix EQ + master
        </button>
        <button
          onClick={onExport}
          className="rounded-full bg-gold px-4 py-2 text-xs font-medium text-ink"
        >
          Export
        </button>
      </div>
    </section>
  )
}
