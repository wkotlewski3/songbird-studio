import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, Track, TrackKind } from '../types'
import { addTrack as addTrackTo, createSession } from './factory'

type SessionApi = {
  session: Session
  setSession: (next: Session | ((s: Session) => Session)) => void
  selected: Track | undefined
  addTrack: (kind: TrackKind) => Track
  updateTrack: (id: string, patch: Partial<Track>) => void
  removeTrack: (id: string) => void
  select: (id: string | null) => void
  toast: string | null
  notify: (message: string) => void
}

const Ctx = createContext<SessionApi | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(createSession)
  const [toast, setToast] = useState<string | null>(null)

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 4200)
  }, [])

  const addTrack = useCallback((kind: TrackKind) => {
    let created!: Track
    setSession((s) => {
      const next = addTrackTo(s, kind)
      created = next.tracks[next.tracks.length - 1]
      return next
    })
    return created
  }, [])

  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setSession((s) => ({
      ...s,
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }, [])

  const removeTrack = useCallback((id: string) => {
    setSession((s) => ({
      ...s,
      tracks: s.tracks.filter((t) => t.id !== id),
      selectedId: s.selectedId === id ? s.tracks.find((t) => t.id !== id)?.id ?? null : s.selectedId,
    }))
  }, [])

  const select = useCallback((id: string | null) => {
    setSession((s) => ({ ...s, selectedId: id }))
  }, [])

  const selected = session.tracks.find((t) => t.id === session.selectedId)

  const value = useMemo(
    () => ({
      session,
      setSession,
      selected,
      addTrack,
      updateTrack,
      removeTrack,
      select,
      toast,
      notify,
    }),
    [session, selected, addTrack, updateTrack, removeTrack, select, toast, notify],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStudio() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStudio outside provider')
  return ctx
}
