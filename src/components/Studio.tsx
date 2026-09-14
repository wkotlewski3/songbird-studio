import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { Layer, Track } from '../types'
import { layerHasContent, trackDuration } from '../types'
import { decodeFile, getAudioContext } from '../audio/context'
import { transcribeDrums, analyzeDrums } from '../audio/drums'
import { transcribeMelody, analyzeMelody } from '../audio/melody'
import { mixFingerprint } from '../audio/mixerState'
import { classifyTake, prepareForLoop, resampleToLength, trimSilence } from '../audio/loopPrep'
import { lockTakeToClick } from '../audio/clickLock'
import { sharedPhraseSeconds } from '../audio/grid'
import { cleanLiveTake } from '../audio/clickStrip'
import {
  applyMixerState,
  getLayerBuffer,
  playSession,
  playbackTime,
  preloadInstrument,
  previewInterpretation,
  previewOriginal,
  sessionDuration,
  setClickMuted,
  setLayerAnalysis,
  setLayerBuffer,
  setLiveSession,
  stopSession,
  type LoopRange,
  type PlayOpts,
} from '../audio/engine'
import { barDuration, barsDuration, beatDuration, formatBarBeat, playCountIn, waitUntil } from '../audio/metronome'
import { armRecorder, type ArmedRecorder } from '../audio/record'
import { useStudio } from '../state/session'
import { BirdMark } from './BirdMark'
import { CommandBar } from './CommandBar'
import { ExportModal } from './ExportModal'
import { Inspector } from './Inspector'
import { Mixer } from './Mixer'
import { PianoRoll } from './PianoRoll'
import { ReviewTake } from './ReviewTake'
import { SessionsModal } from './SessionsModal'
import { Timeline, formatTime } from './Timeline'
import { TrackList } from './TrackList'
import { Visualizer, visColor } from './Visualizer'
import { Waveform } from './Waveform'

export function Studio({ onHome, onAbout }: { onHome: () => void; onAbout: () => void }) {
  const {
    session,
    setSession,
    selected,
    selectedLayer,
    updateLayer,
    addLayer,
    addTrack,
    notify,
    savedStudio,
    saveSketch,
    lastSaved,
    saving,
  } = useStudio()
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [loop, setLoop] = useState<LoopRange | null>(() => savedStudio.loop)
  const [loopOn, setLoopOn] = useState(() => savedStudio.loopOn)
  const [clickOn, setClickOn] = useState(() => savedStudio.clickOn)
  const [countIn, setCountIn] = useState(() => savedStudio.countIn)
  const [countingIn, setCountingIn] = useState(false)
  const [countBeat, setCountBeat] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportPreset, setExportPreset] = useState<'mp3' | 'wav' | 'midi'>('mp3')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const recRef = useRef<ArmedRecorder | null>(null)
  const recStarted = useRef(false)
  const recTarget = useRef<{ trackId: string | null; layerId: string | null } | null>(null)
  const recGen = useRef(0)
  const rawRef = useRef<HTMLInputElement>(null)
  const [dropOver, setDropOver] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [bpmText, setBpmText] = useState(() => String(session.meta.bpm))
  const playingRef = useRef(false)
  const sessionRef = useRef(session)
  const loopRef = useRef({ loop, loopOn })
  const playheadRef = useRef(0)
  const previewRef = useRef<'session' | 'original' | 'interp'>('session')
  playingRef.current = playing
  sessionRef.current = session
  loopRef.current = { loop, loopOn }
  playheadRef.current = playhead

  useEffect(() => {
    setBpmText(String(session.meta.bpm))
  }, [session.meta.bpm])

  const playOpts = (offset: number): PlayOpts => {
    const { loop: range, loopOn: on } = loopRef.current
    return { offset, loop: on ? range : null }
  }

  useEffect(() => {
    applyMixerState(session)
    setLiveSession(session)
  }, [session])

  useEffect(() => {
    setClickMuted(!clickOn)
  }, [clickOn])

  const studioView = { loop, loopOn, clickOn, countIn }

  useEffect(() => {
    if (recordingId || countingIn) return
    const t = window.setTimeout(() => {
      void saveSketch(studioView)
    }, 1400)
    return () => window.clearTimeout(t)
    // studioView is a fresh object; persist the primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loop, loopOn, clickOn, countIn, recordingId, countingIn, saveSketch])

  useEffect(() => {
    const persist = () => {
      void saveSketch({ loop, loopOn, clickOn, countIn })
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        persist()
        notify('Sketch saved in this browser.')
      }
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', persist)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', persist)
    }
  }, [loop, loopOn, clickOn, countIn, saveSketch, notify])

  useEffect(() => () => stopSession(), [])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const t = playbackTime()
      setPlayhead(t)
      const { loop: range, loopOn: on } = loopRef.current
      const end = on && range ? range.end + 0.25 : sessionDuration(sessionRef.current)
      if (!on && t >= end) {
        stopSession()
        setPlaying(false)
        setPlayhead(sessionDuration(sessionRef.current))
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const resumeAt = async (offset: number) => {
    const opts = playOpts(offset)
    const sess = sessionRef.current
    const mode = previewRef.current
    const track = sess.tracks.find((t) => t.id === sess.selectedId)
    const layer = track?.layers.find((l) => l.id === track.selectedLayerId)
    if (mode === 'original' && layer) await previewOriginal(layer.id, opts)
    else if (mode === 'interp' && track && layer) await previewInterpretation(sess, track, layer, opts)
    else await playSession(sess, opts)
    applyMixerState(sess)
  }

  const soundKey = mixFingerprint(session)
  useEffect(() => {
    if (!playingRef.current || recordingId || countingIn) return
    const t = window.setTimeout(() => {
      void resumeAt(playheadRef.current)
    }, 80)
    return () => window.clearTimeout(t)
  }, [soundKey, recordingId, countingIn])

  const seek = async (t: number) => {
    const dur = sessionDuration(sessionRef.current)
    const clamped = Math.max(0, Math.min(t, dur))
    setPlayhead(clamped)
    playheadRef.current = clamped
    if (!playingRef.current) return
    await resumeAt(clamped)
  }

  const scrub = (t: number) => {
    const dur = sessionDuration(sessionRef.current)
    const clamped = Math.max(0, Math.min(t, dur))
    setPlayhead(clamped)
    playheadRef.current = clamped
  }

  const changeLoop = (range: LoopRange | null) => {
    setLoop(range)
    loopRef.current = { ...loopRef.current, loop: range }
    if (range && range.start < 0.05) {
      const bars = Math.max(1, Math.round(range.end / barDuration(sessionRef.current.meta.bpm)))
      setSession((s) => (s.meta.bars === bars ? s : { ...s, meta: { ...s.meta, bars } }))
    }
  }

  const changeLoopOn = (on: boolean) => {
    setLoopOn(on)
    loopRef.current = { ...loopRef.current, loopOn: on }
  }

  const commitBpm = (raw: number) => {
    const to = Math.min(240, Math.max(40, Math.round(raw) || sessionRef.current.meta.bpm))
    const from = sessionRef.current.meta.bpm
    setBpmText(String(to))
    if (to === from) return
    const factor = from / to
    setLoop((prev) => {
      if (!prev) return prev
      const next = { start: prev.start * factor, end: prev.end * factor }
      loopRef.current = { ...loopRef.current, loop: next }
      return next
    })
    setSession((s) => ({
      ...s,
      meta: { ...s.meta, bpm: to },
      tracks: s.tracks.map((track) => ({
        ...track,
        layers: track.layers.map((layer) => {
          const buf = getLayerBuffer(layer.id)
          if (buf) setLayerBuffer(layer.id, resampleToLength(buf, Math.max(0.05, buf.duration * factor)))
          return {
            ...layer,
            duration: layer.duration * factor,
            notes: layer.notes.map((n) => ({
              ...n,
              time: n.time * factor,
              duration: n.duration * factor,
            })),
            drums: layer.drums.map((h) => ({
              ...h,
              time: h.time * factor,
              duration: h.duration * factor,
            })),
          }
        }),
      })),
    }))
  }

  useEffect(() => {
    if (!playingRef.current) return
    void resumeAt(playheadRef.current)
  }, [loop, loopOn])

  const ingest = async (
    track: Track,
    layer: Layer,
    file: Blob,
    opts: { label?: string; live?: boolean; buffer?: AudioBuffer } = {},
  ) => {
    const label = opts.label
    updateLayer(track.id, layer.id, { transcribing: true, progress: 0.05, status: 'Locking onto the click…' })
    try {
      let buffer = opts.buffer ?? (await decodeFile(file))
      const ac = getAudioContext()
      const bpm = sessionRef.current.meta.bpm
      if (opts.live && !opts.buffer) {
        const latency = (ac.baseLatency || 0) + (ac.outputLatency || 0)
        buffer = await cleanLiveTake(buffer, bpm, latency)
      } else if (!opts.live) {
        buffer = trimSilence(buffer)
      }
      const stacking =
        opts.live ||
        sessionRef.current.tracks.some((t) =>
          t.layers.some((l) => l.id !== layer.id && layerHasContent(l)),
        )
      const loopRange = loopRef.current.loopOn ? loopRef.current.loop : null
      const existing = sessionRef.current.tracks.flatMap((t) =>
        t.layers.filter((l) => l.id !== layer.id && layerHasContent(l)).map((l) => l.duration),
      )
      const loopSeconds = stacking
        ? loopRange
          ? loopRange.end - loopRange.start
          : sharedPhraseSeconds(existing, bpm, sessionRef.current.meta.bars)
        : null
      const latency = opts.live ? (ac.baseLatency || 0) + (ac.outputLatency || 0) : 0
      const shift = (time: number) => Math.max(0, time - latency)

      if (track.kind === 'vocals') {
        const prepared = prepareForLoop(buffer, bpm, loopSeconds, { live: !!opts.live })
        buffer = prepared.buffer
        if (prepared.derived) {
          changeLoop({ start: 0, end: prepared.seconds })
          changeLoopOn(true)
          setSession((s) => ({ ...s, meta: { ...s.meta, bars: prepared.bars } }))
        }
        setLayerBuffer(layer.id, buffer)
        updateLayer(track.id, layer.id, {
          duration: buffer.duration,
          transcribing: false,
          progress: 1,
          sourceId: layer.id,
          accepted: true,
          reviewing: false,
          originalMix: 1,
          status: label ?? `Loop-ready vocal · ${prepared.bars} bar${prepared.bars === 1 ? '' : 's'}`,
        })
        notify('Vocal take trimmed and fitted to the bar grid so it loops cleanly.')
        return
      }

      const transcribe =
        track.kind === 'drums'
          ? {
              ...layer.transcribe,
              snap: Math.max(0.5, layer.transcribe.snap),
              onset: layer.transcribe.onset >= 1.15 ? 0.75 : layer.transcribe.onset,
              minNote: layer.transcribe.minNote >= 0.09 ? 0.04 : layer.transcribe.minNote,
            }
          : { ...layer.transcribe, snap: Math.max(0.5, layer.transcribe.snap) }

      if (track.kind === 'drums') {
        updateLayer(track.id, layer.id, { status: 'Reading hits onto the click…', progress: 0.2 })
        const { drums } = transcribeDrums(buffer, transcribe, (p) =>
          updateLayer(track.id, layer.id, { progress: 0.2 + p * 0.7 }),
        )
        const locked = lockTakeToClick({
          buffer,
          notes: [],
          drums: drums.map((h) => ({ ...h, time: shift(h.time) })),
          bpm,
          loopSeconds,
          live: !!opts.live,
          followSession: stacking,
        })
        if (locked.derived) {
          changeLoop({ start: 0, end: locked.seconds })
          changeLoopOn(true)
          setSession((s) => ({ ...s, meta: { ...s.meta, bars: locked.bars } }))
        }
        setLayerBuffer(layer.id, locked.buffer)
        setLayerAnalysis(layer.id, { kind: 'drums', drums: analyzeDrums(locked.buffer) })
        updateLayer(track.id, layer.id, {
          drums: locked.drums,
          notes: [],
          duration: locked.seconds,
          transcribing: false,
          progress: 1,
          sourceId: layer.id,
          transcribe,
          quantize: 1,
          rhythm: locked.feel,
          accepted: true,
          reviewing: locked.drums.length === 0,
          originalMix: 0,
          status:
            locked.drums.length === 0
              ? 'No hits locked — loosen onset until the grid fills, then pick a kit'
              : `Locked · ${locked.feel.label} · ${locked.drums.length} hits · ${locked.bars} bars`,
        })
        void preloadInstrument(layer.instrumentId, layer.drumVoices)
        notify(
          locked.drums.length === 0
            ? 'Could not lock hits yet. Lower onset in the inspector — the kit will follow.'
            : `Beat locked to the click as ${locked.feel.label}. Stretch the loop and it will repeat.`,
        )
        return
      }

      updateLayer(track.id, layer.id, { status: 'Tracing pitch onto the click…', progress: 0.2 })
      const { notes } = transcribeMelody(buffer, transcribe, (p) =>
        updateLayer(track.id, layer.id, { progress: 0.2 + p * 0.7 }),
      )
      const locked = lockTakeToClick({
        buffer,
        notes: notes.map((n) => ({ ...n, time: shift(n.time) })),
        drums: [],
        bpm,
        loopSeconds,
        live: !!opts.live,
        followSession: stacking,
      })
      if (locked.derived) {
        changeLoop({ start: 0, end: locked.seconds })
        changeLoopOn(true)
        setSession((s) => ({ ...s, meta: { ...s.meta, bars: locked.bars } }))
      }
      setLayerBuffer(layer.id, locked.buffer)
      setLayerAnalysis(layer.id, { kind: 'melody', melody: analyzeMelody(locked.buffer) })
      updateLayer(track.id, layer.id, {
        notes: locked.notes,
        drums: [],
        duration: locked.seconds,
        transcribing: false,
        progress: 1,
        sourceId: layer.id,
        transcribe,
        quantize: 1,
        rhythm: locked.feel,
        accepted: true,
        reviewing: locked.notes.length === 0,
        originalMix: 0,
        status:
          locked.notes.length === 0
            ? 'No notes locked — loosen gate or confidence until the piano roll fills'
            : `Locked · ${locked.feel.label} · ${locked.notes.length} notes · ${locked.bars} bars`,
      })
      void preloadInstrument(layer.instrumentId)
      notify(
        locked.notes.length === 0
          ? 'Could not lock a melody yet. Loosen gate in the inspector — guitar and piano will follow.'
          : `Melody locked to the click as ${locked.feel.label}. Stretch the loop and it will repeat.`,
      )
    } catch (err) {
      updateLayer(track.id, layer.id, {
        transcribing: false,
        status: err instanceof Error ? err.message : 'Could not read that file',
      })
    }
  }

  const targetLayer = (track: Track, layer: Layer) =>
    layerHasContent(layer) ? addLayer(track.id) : layer

  const placeRaw = async (file: File, into?: { track: Track; layer: Layer }) => {
    if (into) {
      await ingest(into.track, targetLayer(into.track, into.layer), file, {
        label: file.name,
      })
      return
    }
    notify('Reading the raw take…')
    try {
      const buffer = await decodeFile(file)
      const kind = classifyTake(buffer)
      const track = addTrack(kind)
      const layer = track.layers[0]
      notify(
        kind === 'drums'
          ? 'Heard a beat — snapping hits to the metronome.'
          : kind === 'vocals'
            ? 'Heard a vocal — trimming it so the loop is clean.'
            : 'Heard a melody — putting the notes on the grid.',
      )
      await ingest(track, layer, file, { buffer, label: file.name })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read that file')
    }
  }

  const onFile = (track: Track, layer: Layer, file: File) => {
    void placeRaw(file, { track, layer })
  }

  const onRawFiles = (files: FileList | File[] | null) => {
    const file = files && [...files].find((f) => f.type.startsWith('audio') || /\.(wav|mp3|m4a|ogg|flac|webm|aiff?)$/i.test(f.name))
    if (!file) {
      notify('Drop an audio file — wav, mp3, m4a, or similar.')
      return
    }
    void placeRaw(file)
  }

  const finishRecording = async () => {
    const armed = recRef.current
    const target = recTarget.current
    recRef.current = null
    recTarget.current = null
    recStarted.current = false
    recGen.current += 1
    setRecordingId(null)
    setCountingIn(false)
    setCountBeat(0)
    if (!armed || !target) {
      armed?.cancel()
      return
    }
    try {
      const blob = await armed.stop()
      if (blob.size < 200) return
      const ac = getAudioContext()
      const latency = (ac.baseLatency || 0) + (ac.outputLatency || 0)
      const buffer = await cleanLiveTake(await decodeFile(blob), sessionRef.current.meta.bpm, latency)
      let recTrack = target.trackId
        ? sessionRef.current.tracks.find((t) => t.id === target.trackId)
        : undefined
      let recLayer = recTrack?.layers.find((l) => l.id === target.layerId)
      if (!recTrack || !recLayer) {
        const kind = classifyTake(buffer)
        recTrack = addTrack(kind)
        recLayer = recTrack.layers[0]
        notify(
          kind === 'drums'
            ? 'Live beat is on the grid.'
            : kind === 'vocals'
              ? 'Live vocal is trimmed to the loop.'
              : 'Live melody is snapped to the click.',
        )
        await ingest(recTrack, recLayer, blob, { buffer, live: true, label: 'Live take' })
      } else {
        await ingest(recTrack, recLayer, blob, { buffer, live: true, label: 'Live take' })
      }
      if (playingRef.current) {
        window.setTimeout(() => {
          const range = loopRef.current.loopOn ? loopRef.current.loop : null
          void resumeAt(range?.start ?? playheadRef.current)
        }, 40)
      }
    } catch {
      notify('Recording failed.')
    }
  }

  const onRecord = async (track?: Track, layer?: Layer) => {
    if (recStarted.current && recRef.current) {
      await finishRecording()
      return
    }
    if (recRef.current || countingIn) {
      recGen.current += 1
      recRef.current?.cancel()
      recRef.current = null
      recTarget.current = null
      recStarted.current = false
      setRecordingId(null)
      setCountingIn(false)
      setCountBeat(0)
      if (track && layer) updateLayer(track.id, layer.id, { status: 'Ready to record on the click' })
      return
    }

    const dest = track && layer ? targetLayer(track, layer) : null
    const gen = recGen.current + 1
    recGen.current = gen
    const range = loopRef.current.loopOn ? loopRef.current.loop : null
    const mark = (status: string) => {
      if (track && dest) updateLayer(track.id, dest.id, { status })
    }

    try {
      const armed = await armRecorder()
      if (recGen.current !== gen) {
        armed.cancel()
        return
      }
      recRef.current = armed
      recTarget.current = {
        trackId: track && dest ? track.id : null,
        layerId: dest?.id ?? null,
      }
      setRecordingId(dest?.id ?? 'live')

      if (countIn && !playingRef.current) {
        setCountingIn(true)
        mark('Count-in…')
        const beatMs = beatDuration(sessionRef.current.meta.bpm) * 1000
        setCountBeat(1)
        const pulse = window.setInterval(() => {
          setCountBeat((n) => (n % 4) + 1)
        }, beatMs)
        await playCountIn(sessionRef.current.meta.bpm)
        window.clearInterval(pulse)
        if (recGen.current !== gen) {
          armed.cancel()
          recRef.current = null
          setCountingIn(false)
          setCountBeat(0)
          return
        }
        setCountingIn(false)
        setCountBeat(0)
      }

      if (!playingRef.current) {
        previewRef.current = 'session'
        const offset = range?.start ?? 0
        await playSession(sessionRef.current, playOpts(offset))
        applyMixerState(sessionRef.current)
        setPlaying(true)
      } else if (range) {
        mark('Recording next pass…')
        const started = playbackTime()
        const ready = await waitUntil(() => {
          const t = playbackTime()
          return t <= range.start + 0.12 && (started <= range.start + 0.12 || t + 0.05 < started)
        }, () => recGen.current !== gen)
        if (!ready || recGen.current !== gen) {
          armed.cancel()
          recRef.current = null
          recTarget.current = null
          setRecordingId(null)
          return
        }
      }

      if (recGen.current !== gen) {
        armed.cancel()
        recRef.current = null
        return
      }

      armed.start()
      recStarted.current = true
      mark(
        range
          ? 'Recording this loop… tap Stop or wait for the end'
          : 'Recording… tap Stop when you are done',
      )
      if (!track) notify('Recording live — SongBird will sort melody, vocal, or beat onto the grid.')

      if (range) {
        let last = playbackTime()
        const captured = await waitUntil(() => {
          const t = playbackTime()
          const wrapped = t + 0.12 < last
          last = Math.max(last, t)
          return wrapped || t >= range.end - 0.05
        }, () => recGen.current !== gen)
        if (captured && recGen.current === gen && recRef.current) await finishRecording()
      }
    } catch {
      recRef.current = null
      recTarget.current = null
      setRecordingId(null)
      setCountingIn(false)
      notify('Microphone permission is needed to record.')
    }
  }

  const togglePlay = async () => {
    if (playing) {
      if (recStarted.current) await finishRecording()
      else if (recRef.current) {
        recGen.current += 1
        recRef.current.cancel()
        recRef.current = null
        recTarget.current = null
        setRecordingId(null)
        setCountingIn(false)
      }
      stopSession()
      setPlaying(false)
      return
    }
    try {
      previewRef.current = 'session'
      const dur = sessionDuration(session)
      const { loop: range, loopOn: on } = loopRef.current
      let offset = playhead
      if (on && range) {
        if (offset < range.start || offset >= range.end - 0.03) offset = range.start
      } else if (offset >= dur - 0.05) {
        offset = 0
      }
      await playSession(session, playOpts(offset))
      applyMixerState(session)
      setPlaying(true)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not play')
    }
  }

  const buffer = selectedLayer ? getLayerBuffer(selectedLayer.id) : undefined
  const timelineDuration = Math.max(
    selected ? trackDuration(selected) : 0,
    buffer?.duration ?? 0,
    loopOn && loop ? loop.end : 0,
    barsDuration(session.meta.bpm, session.meta.bars),
    1,
  )

  const onDragOver = (e: DragEvent) => {
    if (![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropOver(true)
  }

  return (
    <div
      className="relative flex min-h-screen flex-col"
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDropOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDropOver(false)
        onRawFiles(e.dataTransfer.files)
      }}
    >
      {dropOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-ink/80">
          <div className="rounded-3xl border border-gold bg-panel px-8 py-6 text-center shadow-2xl">
            <p className="font-display text-2xl text-gold">Drop the raw take</p>
            <p className="mt-2 text-sm text-mute">
              SongBird will hear melody, vocal, or beat, snap it to the click, and clean the loop.
            </p>
          </div>
        </div>
      )}
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-panel px-4 py-3">
        <button
          onClick={() => {
            void saveSketch(studioView).finally(onHome)
          }}
          className="flex items-center gap-2"
        >
          <BirdMark className="h-8 w-8" />
          <span className="font-display text-gold">SongBird</span>
        </button>
        <button
          type="button"
          onClick={onAbout}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-mute hover:border-gold hover:text-gold"
        >
          About
        </button>
        <button
          type="button"
          onClick={() => setSessionsOpen(true)}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:border-gold hover:text-gold"
        >
          Sessions
        </button>
        <button
          type="button"
          onClick={() => {
            void saveSketch(studioView).then(() => notify('Sketch saved in this browser.'))
          }}
          className="rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:border-gold hover:text-gold"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {lastSaved && !saving && (
          <span className="hidden text-[11px] text-mute sm:inline">Saved</span>
        )}
        <input
          value={session.meta.title}
          onChange={(e) => setSession({ ...session, meta: { ...session.meta, title: e.target.value } })}
          className="w-44 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-white outline-none focus:border-line"
        />
        <input
          value={session.meta.artist}
          onChange={(e) => setSession({ ...session, meta: { ...session.meta, artist: e.target.value } })}
          placeholder="Artist"
          className="w-36 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-mist outline-none focus:border-line"
        />
        <label className="flex items-center gap-2 text-xs text-mute">
          BPM
          <input
            type="number"
            min={40}
            max={240}
            value={bpmText}
            onChange={(e) => setBpmText(e.target.value)}
            onBlur={() => commitBpm(Number(bpmText))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className="w-16 rounded-lg border border-line bg-ink px-2 py-1 text-mist"
          />
        </label>
        <button
          onClick={() => setClickOn((on) => !on)}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            clickOn ? 'border-gold bg-gold/15 text-gold' : 'border-line text-mute'
          }`}
          title={clickOn ? 'Mute the metronome — it is only in your ears, never in the take' : 'Hear the metronome (guide only, not recorded)'}
        >
          {clickOn ? 'Click' : 'Click muted'}
        </button>
        <button
          onClick={() => setCountIn((on) => !on)}
          className={`rounded-full border px-3 py-1.5 text-xs ${
            countIn ? 'border-gold/70 text-gold' : 'border-line text-mute'
          }`}
          title="One bar of metronome before a live take. Mute Click to count in silently. Never recorded."
        >
          Count-in {countIn ? 'on' : 'off'}
        </button>
        <button
          onClick={() => void togglePlay()}
          className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink"
        >
          {playing ? 'Stop' : 'Play'}
        </button>
        <button
          onClick={() => void onRecord(selected, selectedLayer)}
          className={`rounded-full border px-4 py-2 text-sm ${
            recordingId || countingIn ? 'border-drums text-drums' : 'border-line text-mist hover:border-gold'
          }`}
        >
          {countingIn ? `Count-in ${countBeat || 1}` : recordingId ? 'Stop rec' : 'Record live'}
        </button>
        <button
          type="button"
          onClick={() => rawRef.current?.click()}
          className="rounded-full border border-line px-4 py-2 text-sm text-mist hover:border-gold"
        >
          Raw file
        </button>
        <input
          ref={rawRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            onRawFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="font-mono text-xs text-mist">
          {formatBarBeat(playhead, session.meta.bpm)}
          <span className="text-mute"> · {formatTime(playhead)}</span>
        </span>
        <div className="min-w-[280px] flex-1">
          <CommandBar
            onExport={(format) => {
              setExportPreset(format)
              setExportOpen(true)
            }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <TrackList
          onFile={onFile}
          onRecord={(t, l) => void onRecord(t, l)}
          recordingId={recordingId}
          waiting={countingIn}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-5">
          {selected ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-mute">
                  {selected.kind} · {selected.layers.length} layer{selected.layers.length === 1 ? '' : 's'}
                </p>
                <h2 className="font-display text-3xl text-white">{selected.name}</h2>
                <p className="text-sm text-mute">{selectedLayer?.status ?? 'Add a layer'}</p>
              </div>
              {selectedLayer && (
                <Visualizer
                  layerId={selectedLayer.id}
                  master
                  color={visColor[selected.kind]}
                  variant="hero"
                />
              )}
              {selectedLayer?.reviewing && selected.kind !== 'vocals' ? (
                <ReviewTake
                  track={selected}
                  layer={selectedLayer}
                  playhead={playhead}
                  loop={loop}
                  loopOn={loopOn}
                  onSeek={(t) => void seek(t)}
                  onScrub={scrub}
                  onLoop={changeLoop}
                  onLoopOn={changeLoopOn}
                  onPlaying={setPlaying}
                  onPreview={(mode) => {
                    previewRef.current = mode
                  }}
                />
              ) : (
                <Timeline
                  duration={timelineDuration}
                  bpm={session.meta.bpm}
                  playhead={playhead}
                  loop={loop}
                  loopOn={loopOn}
                  onSeek={(t) => void seek(t)}
                  onScrub={scrub}
                  onLoop={changeLoop}
                  onLoopOn={changeLoopOn}
                >
                  {selected.kind === 'vocals' ? (
                    <Waveform buffer={buffer} span={timelineDuration} />
                  ) : (
                    <>
                      <PianoRoll
                        layers={selected.layers}
                        duration={timelineDuration}
                        playhead={playhead}
                        bpm={session.meta.bpm}
                        bars={session.meta.bars}
                      />
                      {buffer && <Waveform buffer={buffer} color="#e8b86d" span={timelineDuration} />}
                    </>
                  )}
                </Timeline>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-mute">Metronome</p>
                <h2 className="font-display text-3xl text-white">Build on the grid</h2>
                <p className="text-sm text-mute">
                  {recordingId === 'live'
                    ? 'Recording live. When the pass ends, SongBird locks the take to the click — even if you recorded with the click muted.'
                    : `Hit Record live, drop a raw file, or use Raw file. SongBird hears the kind of take, matches its groove (1/4, 1/8, 1/16…), and locks it to this ${session.meta.bars}-bar click.`}
                </p>
              </div>
              <Timeline
                duration={timelineDuration}
                bpm={session.meta.bpm}
                playhead={playhead}
                loop={loop}
                loopOn={loopOn}
                onSeek={(t) => void seek(t)}
                onScrub={scrub}
                onLoop={changeLoop}
                onLoopOn={changeLoopOn}
              >
                <div className="flex h-28 items-center justify-center text-sm text-mute">
                  {recordingId === 'live' ? 'Capturing this pass…' : 'Empty arrangement — record or drop a take.'}
                </div>
              </Timeline>
              <Visualizer master color="#e8b86d" variant="hero" />
            </div>
          )}
        </main>
        <Inspector />
      </div>
      <Mixer
        onExport={() => {
          setExportPreset('mp3')
          setExportOpen(true)
        }}
      />
      <ExportModal open={exportOpen} preset={exportPreset} onClose={() => setExportOpen(false)} />
      <SessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} studio={studioView} />
      <Toast />
    </div>
  )
}

function Toast() {
  const { toast } = useStudio()
  if (!toast) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-40 max-w-lg -translate-x-1/2 rounded-full border border-gold/40 bg-panel px-5 py-3 text-sm text-mist shadow-2xl">
      {toast}
    </div>
  )
}
