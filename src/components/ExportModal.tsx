import { useEffect, useState } from 'react'
import { bounceSession } from '../audio/engine'
import {
  buildMidi,
  downloadBytes,
  encodeMp3,
  encodeWav,
  fileBase,
  wrapId3,
} from '../audio/export'
import { useStudio } from '../state/session'

export function ExportModal({
  open,
  onClose,
  preset,
}: {
  open: boolean
  onClose: () => void
  preset?: 'mp3' | 'wav' | 'midi'
}) {
  const { session, setSession, notify } = useStudio()
  const [busy, setBusy] = useState<string | null>(null)
  const [format, setFormat] = useState<'mp3' | 'wav' | 'midi'>(preset ?? 'mp3')

  useEffect(() => {
    if (open && preset) setFormat(preset)
  }, [open, preset])
  const meta = session.meta
  const setMeta = (patch: Partial<typeof meta>) =>
    setSession({ ...session, meta: { ...meta, ...patch } })

  if (!open) return null

  const go = async () => {
    const name = fileBase(session)
    try {
      if (format === 'midi') {
        setBusy('Writing MIDI…')
        downloadBytes(buildMidi(session), `${name}.mid`, 'audio/midi')
        notify(`Saved ${name}.mid`)
        onClose()
        return
      }
      setBusy('Rendering mix…')
      const buffer = await bounceSession(session)
      if (format === 'wav') {
        setBusy('Writing WAV…')
        downloadBytes(encodeWav(buffer), `${name}.wav`, 'audio/wav')
        notify(`Saved ${name}.wav`)
      } else {
        setBusy('Encoding MP3 + ID3 tags…')
        const mp3 = await encodeMp3(buffer)
        const tagged = wrapId3(mp3, meta)
        downloadBytes(tagged, `${name}.mp3`, 'audio/mpeg')
        notify(`Saved ${name}.mp3 with title and artist tags`)
      }
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl text-white">Export</h2>
        <p className="mt-1 text-sm text-mute">Tags are written into the MP3 so players show the right work.</p>
        <div className="mt-4 grid gap-3">
          {(
            [
              ['Title', 'title'],
              ['Artist', 'artist'],
              ['Album', 'album'],
              ['Year', 'year'],
              ['Genre', 'genre'],
            ] as const
          ).map(([label, key]) => (
            <label key={key} className="text-xs text-mute">
              {label}
              <input
                value={meta[key]}
                onChange={(e) => setMeta({ [key]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
              />
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            {(['mp3', 'wav', 'midi'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-full border px-3 py-1 text-xs uppercase ${
                  format === f ? 'border-gold text-gold' : 'border-line text-mist'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-mute">
            Cancel
          </button>
          <button
            disabled={!!busy}
            onClick={() => void go()}
            className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            {busy ?? `Download ${fileBase(session)}.${format}`}
          </button>
        </div>
      </div>
    </div>
  )
}
