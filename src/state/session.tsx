import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Layer, Session, Track, TrackKind } from '../types'
import { selectedLayerOf, takeIdOf } from '../types'
import { addLayerToTrack, addTrack as addTrackTo, createSession, layerFromTake, uid } from './factory'
import {
  clearAllLayerAudio,
  getLayerAnalysis,
  getLayerBuffer,
  preloadInstrument,
  setLayerAnalysis,
  setLayerBuffer,
  stopSession,
} from '../audio/engine'
import {
  captureProject,
  defaultStudioView,
  deleteProject,
  downloadProject,
  fileToProject,
  getProject,
  hydrateProject,
  isPersistError,
  listProjects,
  loadCurrentProject,
  projectHasWork,
  putProject,
  readCurrentId,
  type SketchSummary,
  type StoredProject,
  type StudioView,
  writeCurrentId,
} from './persist'

type SessionApi = {
  session: Session
  setSession: (next: Session | ((s: Session) => Session)) => void
  selected: Track | undefined
  selectedLayer: Layer | undefined
  addTrack: (kind: TrackKind) => Track
  addLayer: (trackId: string) => Layer
  stackLayer: (trackId: string, layerId: string) => Layer | undefined
  addSoundFromTake: (trackId: string, layerId: string, instrumentId: string) => Layer | undefined
  reuseTake: (trackId: string, destLayerId: string, sourceLayerId: string) => void
  updateTrack: (id: string, patch: Partial<Track>) => void
  updateLayer: (trackId: string, layerId: string, patch: Partial<Layer>) => void
  removeTrack: (id: string) => void
  removeLayer: (trackId: string, layerId: string) => void
  select: (id: string | null) => void
  selectLayer: (trackId: string, layerId: string) => void
  toast: string | null
  notify: (message: string) => void
  ready: boolean
  projectId: string
  lastSaved: number | null
  saving: boolean
  savedStudio: StudioView
  hasWork: boolean
  saveSketch: (studio: StudioView) => Promise<void>
  newSketch: (kind?: TrackKind) => Promise<void>
  openSketch: (id: string) => Promise<void>
  deleteSketch: (id: string) => Promise<void>
  listSketches: () => Promise<SketchSummary[]>
  downloadSketch: (studio: StudioView) => Promise<void>
  importSketch: (file: File) => Promise<void>
  duplicateSketch: (studio: StudioView) => Promise<void>
}

const Ctx = createContext<SessionApi | null>(null)

function patchTrack(session: Session, trackId: string, fn: (track: Track) => Track): Session {
  return {
    ...session,
    tracks: session.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(createSession)
  const [toast, setToast] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [projectId, setProjectId] = useState(() => readCurrentId() ?? uid())
  const [savedStudio, setSavedStudio] = useState<StudioView>(defaultStudioView)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const existingRef = useRef<StoredProject | undefined>(undefined)
  const saveChain = useRef(Promise.resolve())
  const sessionRef = useRef(session)
  const projectIdRef = useRef(projectId)
  const studioRef = useRef(savedStudio)
  sessionRef.current = session
  projectIdRef.current = projectId
  studioRef.current = savedStudio

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 4200)
  }, [])

  const applyProject = useCallback((project: StoredProject) => {
    stopSession()
    hydrateProject(project)
    existingRef.current = project
    writeCurrentId(project.id)
    setProjectId(project.id)
    setSession(project.session)
    setSavedStudio(project.studio)
    setLastSaved(project.savedAt)
    for (const track of project.session.tracks) {
      for (const layer of track.layers) void preloadInstrument(layer.instrumentId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const loaded = await loadCurrentProject()
        if (cancelled) return
        if (loaded) applyProject(loaded)
        else writeCurrentId(projectId)
      } catch {
        if (!cancelled) writeCurrentId(projectId)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // Boot once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSketch = useCallback(
    (studio: StudioView) => {
      const job = async () => {
        setSaving(true)
        try {
          const project = captureProject(sessionRef.current, studio, existingRef.current)
          project.id = projectId
          await putProject(project)
          existingRef.current = project
          writeCurrentId(project.id)
          setLastSaved(project.savedAt)
          setSavedStudio(studio)
          studioRef.current = studio
        } catch (err) {
          notify(isPersistError(err))
        } finally {
          setSaving(false)
        }
      }
      const next = saveChain.current.then(job, job)
      saveChain.current = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    },
    [notify, projectId],
  )

  const stashCurrent = useCallback(async () => {
    try {
      const snapshot = captureProject(sessionRef.current, studioRef.current, existingRef.current)
      snapshot.id = projectIdRef.current
      await putProject(snapshot)
      existingRef.current = snapshot
    } catch {
      /* keep going — caller may be opening or creating another sketch */
    }
  }, [])

  const newSketch = useCallback(async (kind?: TrackKind, keepPrevious = true) => {
    if (keepPrevious) await stashCurrent()
    stopSession()
    clearAllLayerAudio()
    const id = uid()
    let next = createSession()
    if (kind) next = addTrackTo(next, kind)
    existingRef.current = undefined
    writeCurrentId(id)
    setProjectId(id)
    setSession(next)
    const view = defaultStudioView(next.meta.bpm, next.meta.bars)
    setSavedStudio(view)
    studioRef.current = view
    setLastSaved(null)
  }, [stashCurrent])

  const openSketch = useCallback(
    async (id: string) => {
      await stashCurrent()
      const project = await getProject(id)
      if (!project) {
        notify('That sketch is no longer in this browser.')
        return
      }
      applyProject(project)
    },
    [applyProject, notify, stashCurrent],
  )

  const deleteSketch = useCallback(
    async (id: string) => {
      const droppingCurrent = id === projectIdRef.current
      await deleteProject(id)
      if (droppingCurrent) await newSketch(undefined, false)
    },
    [newSketch],
  )

  const listSketches = useCallback(() => listProjects(), [])

  const downloadSketch = useCallback(
    async (studio: StudioView) => {
      const project = captureProject(sessionRef.current, studio, existingRef.current)
      project.id = projectId
      downloadProject(project)
      try {
        await putProject(project)
        existingRef.current = project
        setLastSaved(project.savedAt)
      } catch (err) {
        notify(isPersistError(err))
      }
    },
    [notify, projectId],
  )

  const importSketch = useCallback(
    async (file: File) => {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        notify('That file could not be read.')
        return
      }
      try {
        const project = fileToProject(parsed)
        await putProject(project)
        applyProject(project)
        notify(`Opened ${project.session.meta.title}`)
      } catch (err) {
        notify(isPersistError(err))
      }
    },
    [applyProject, notify],
  )

  const duplicateSketch = useCallback(
    async (studio: StudioView) => {
      const copy = captureProject(sessionRef.current, studio, existingRef.current)
      copy.id = uid()
      copy.createdAt = Date.now()
      copy.savedAt = Date.now()
      copy.session = {
        ...copy.session,
        meta: { ...copy.session.meta, title: `${copy.session.meta.title} copy` },
      }
      await putProject(copy)
      applyProject(copy)
      notify('Saved a new copy in this browser.')
    },
    [applyProject, notify],
  )

  const addTrack = useCallback((kind: TrackKind) => {
    let created!: Track
    setSession((s) => {
      const next = addTrackTo(s, kind)
      created = next.tracks[next.tracks.length - 1]
      return next
    })
    return created
  }, [])

  const addLayer = useCallback((trackId: string) => {
    let created!: Layer
    setSession((s) =>
      patchTrack(s, trackId, (track) => {
        const next = addLayerToTrack(track)
        created = next.layers[next.layers.length - 1]
        return next
      }),
    )
    return created
  }, [])

  const addSoundFromTake = useCallback((trackId: string, layerId: string, instrumentId: string) => {
    let created: Layer | undefined
    setSession((s) =>
      patchTrack(s, trackId, (track) => {
        const source = track.layers.find((l) => l.id === layerId)
        if (!source) return track
        const next = layerFromTake(track, source, instrumentId)
        created = next.layers[next.layers.length - 1]
        const buffer = getLayerBuffer(source.id)
        if (buffer && created) setLayerBuffer(created.id, buffer)
        const analysis = getLayerAnalysis(source.id)
        if (analysis && created) setLayerAnalysis(created.id, analysis)
        return next
      }),
    )
    return created
  }, [])

  const reuseTake = useCallback((trackId: string, destLayerId: string, sourceLayerId: string) => {
    setSession((s) =>
      patchTrack(s, trackId, (track) => {
        const source = track.layers.find((l) => l.id === sourceLayerId)
        const dest = track.layers.find((l) => l.id === destLayerId)
        if (!source || !dest) return track
        const buffer = getLayerBuffer(source.id)
        if (buffer) setLayerBuffer(dest.id, buffer)
        const analysis = getLayerAnalysis(source.id)
        if (analysis) setLayerAnalysis(dest.id, analysis)
        return {
          ...track,
          selectedLayerId: dest.id,
          layers: track.layers.map((l) =>
            l.id === dest.id
              ? {
                  ...l,
                  notes: source.notes,
                  drums: source.drums,
                  duration: source.duration,
                  quantize: source.quantize,
                  sourceId: takeIdOf(source),
                  status: `Same take · ${l.name}`,
                }
              : l,
          ),
        }
      }),
    )
  }, [])

  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setSession((s) => patchTrack(s, id, (t) => ({ ...t, ...patch, layers: patch.layers ?? t.layers })))
  }, [])

  const updateLayer = useCallback((trackId: string, layerId: string, patch: Partial<Layer>) => {
    setSession((s) =>
      patchTrack(s, trackId, (t) => ({
        ...t,
        layers: t.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      })),
    )
  }, [])

  const removeTrack = useCallback((id: string) => {
    setSession((s) => ({
      ...s,
      tracks: s.tracks.filter((t) => t.id !== id),
      selectedId: s.selectedId === id ? s.tracks.find((t) => t.id !== id)?.id ?? null : s.selectedId,
    }))
  }, [])

  const removeLayer = useCallback((trackId: string, layerId: string) => {
    setSession((s) =>
      patchTrack(s, trackId, (t) => {
        if (t.layers.length <= 1) return t
        const layers = t.layers.filter((l) => l.id !== layerId)
        return {
          ...t,
          layers,
          selectedLayerId: t.selectedLayerId === layerId ? layers[0]?.id ?? null : t.selectedLayerId,
        }
      }),
    )
  }, [])

  const select = useCallback((id: string | null) => {
    setSession((s) => ({ ...s, selectedId: id }))
  }, [])

  const selectLayer = useCallback((trackId: string, layerId: string) => {
    setSession((s) => ({
      ...s,
      selectedId: trackId,
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, selectedLayerId: layerId } : t)),
    }))
  }, [])

  const stackLayer = useCallback(
    (trackId: string, layerId: string) => {
      const track = session.tracks.find((t) => t.id === trackId)
      const layer = track?.layers.find((l) => l.id === layerId)
      if (!layer) return undefined
      return addSoundFromTake(trackId, layerId, layer.instrumentId)
    },
    [session.tracks, addSoundFromTake],
  )

  const selected = session.tracks.find((t) => t.id === session.selectedId)
  const selectedLayer = selectedLayerOf(selected)
  const hasWork = projectHasWork(session)

  const value = useMemo(
    () => ({
      session,
      setSession,
      selected,
      selectedLayer,
      addTrack,
      addLayer,
      stackLayer,
      addSoundFromTake,
      reuseTake,
      updateTrack,
      updateLayer,
      removeTrack,
      removeLayer,
      select,
      selectLayer,
      toast,
      notify,
      ready,
      projectId,
      lastSaved,
      saving,
      savedStudio,
      hasWork,
      saveSketch,
      newSketch,
      openSketch,
      deleteSketch,
      listSketches,
      downloadSketch,
      importSketch,
      duplicateSketch,
    }),
    [
      session,
      selected,
      selectedLayer,
      addTrack,
      addLayer,
      stackLayer,
      addSoundFromTake,
      reuseTake,
      updateTrack,
      updateLayer,
      removeTrack,
      removeLayer,
      select,
      selectLayer,
      toast,
      notify,
      ready,
      projectId,
      lastSaved,
      saving,
      savedStudio,
      hasWork,
      saveSketch,
      newSketch,
      openSketch,
      deleteSketch,
      listSketches,
      downloadSketch,
      importSketch,
      duplicateSketch,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStudio() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStudio outside provider')
  return ctx
}
