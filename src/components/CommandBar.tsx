import { useState } from 'react'
import { interpretCommand } from '../audio/commands'
import { useStudio } from '../state/session'

export function CommandBar({
  onExport,
  onVideo,
}: {
  onExport: (format: 'mp3' | 'wav' | 'midi') => void
  onVideo?: (opts: { generate?: boolean }) => void
}) {
  const { session, setSession, notify } = useStudio()
  const [text, setText] = useState('')

  const run = () => {
    const result = interpretCommand(text, session)
    if (result.session) setSession(result.session)
    notify(result.message)
    if (result.exportFormat) onExport(result.exportFormat)
    if (result.openVideo) onVideo?.({ generate: result.generateVideo })
    setText('')
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        run()
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='“make a video about night market” or “fix EQ and export mp3”'
        className="flex-1 rounded-full border border-line bg-ink px-4 py-2 text-sm text-white outline-none placeholder:text-mute focus:border-gold"
      />
      <button type="submit" className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink">
        Do it
      </button>
    </form>
  )
}
