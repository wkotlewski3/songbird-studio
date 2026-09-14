import { useEffect, useState } from 'react'
import type { TrackKind } from './types'
import { About } from './components/About'
import { Landing } from './components/Landing'
import { Studio } from './components/Studio'
import { SessionProvider, useStudio } from './state/session'
import { writeLastView, readLastView } from './state/persist'

function Shell() {
  const [view, setView] = useState<'landing' | 'studio'>(readLastView)
  const [about, setAbout] = useState(false)
  const { addTrack, newSketch, hasWork, session, lastSaved, ready, projectId } = useStudio()

  const go = (next: 'landing' | 'studio') => {
    writeLastView(next)
    setView(next)
  }

  const start = (kind?: TrackKind, fresh = false) => {
    void (async () => {
      if (fresh) await newSketch(kind)
      else if (kind) addTrack(kind)
      go('studio')
    })()
  }

  useEffect(() => {
    if (!about) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbout(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [about])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-mute">Opening last sketch…</div>
    )
  }

  return (
    <>
      {view === 'landing' ? (
        <Landing
          onStart={start}
          onContinue={() => go('studio')}
          onAbout={() => setAbout(true)}
          resume={
            hasWork
              ? { title: session.meta.title, savedAt: lastSaved, bpm: session.meta.bpm }
              : null
          }
        />
      ) : (
        <Studio key={projectId} onHome={() => go('landing')} onAbout={() => setAbout(true)} />
      )}
      <About open={about} onClose={() => setAbout(false)} />
    </>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <div className="grain" />
      <Shell />
    </SessionProvider>
  )
}
