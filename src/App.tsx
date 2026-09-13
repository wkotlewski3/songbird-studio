import { useState } from 'react'
import type { TrackKind } from './types'
import { Landing } from './components/Landing'
import { Studio } from './components/Studio'
import { SessionProvider, useStudio } from './state/session'

function Shell() {
  const [view, setView] = useState<'landing' | 'studio'>('landing')
  const { addTrack } = useStudio()

  const start = (kind?: TrackKind) => {
    if (kind) addTrack(kind)
    setView('studio')
  }

  return view === 'landing' ? (
    <Landing onStart={start} />
  ) : (
    <Studio onHome={() => setView('landing')} />
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
