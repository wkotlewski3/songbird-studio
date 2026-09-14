import { getAudioContext } from '../audio/context'
import {
  clearAllLayerAudio,
  getLayerAnalysis,
  getLayerBuffer,
  setLayerAnalysis,
  setLayerBuffer,
  type LayerAnalysis,
} from '../audio/engine'
import { barsDuration } from '../audio/metronome'
import { fileBase } from '../audio/export'
import type { Session } from '../types'
import { uid } from './factory'

const DB_NAME = 'songbird-studio'
const DB_VERSION = 1
const STORE = 'projects'
const CURRENT_KEY = 'songbird.currentId'
const VIEW_KEY = 'songbird.view'

export type StudioView = {
  loop: { start: number; end: number } | null
  loopOn: boolean
  clickOn: boolean
  countIn: boolean
}

export type SketchSummary = {
  id: string
  title: string
  artist: string
  bpm: number
  bars: number
  tracks: number
  savedAt: number
  createdAt: number
}

type StoredBuffer = {
  sampleRate: number
  channels: Float32Array[]
}

export type StoredProject = {
  id: string
  createdAt: number
  savedAt: number
  session: Session
  studio: StudioView
  buffers: Record<string, StoredBuffer>
  bufferForLayer: Record<string, string>
  analyses: Record<string, LayerAnalysis>
}

type FileBuffer = { sampleRate: number; channels: string[] }
type FileAnalysis =
  | {
      kind: 'melody'
      melody: { times: number[]; freqs: number[]; probs: number[]; energies: number[] }
    }
  | {
      kind: 'drums'
      drums: { flux: number[]; hop: number; size: number; sampleRate: number }
    }

export type ProjectFile = {
  kind: 'songbird-studio'
  v: 1
  id: string
  createdAt: number
  savedAt: number
  session: Session
  studio: StudioView
  buffers: Record<string, FileBuffer>
  bufferForLayer: Record<string, string>
  analyses: Record<string, FileAnalysis>
}

export function defaultStudioView(bpm = 92, bars = 4): StudioView {
  return {
    loop: { start: 0, end: barsDuration(bpm, bars) },
    loopOn: true,
    clickOn: true,
    countIn: true,
  }
}

export function projectHasWork(session: Session): boolean {
  if (session.meta.title !== 'Untitled sketch') return true
  if (session.meta.artist.trim()) return true
  if (session.tracks.length > 0) return true
  return false
}

export function readCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}

export function writeCurrentId(id: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, id)
  } catch {
    /* private mode */
  }
}

export function readLastView(): 'landing' | 'studio' {
  try {
    return localStorage.getItem(VIEW_KEY) === 'studio' ? 'studio' : 'landing'
  } catch {
    return 'landing'
  }
}

export function writeLastView(view: 'landing' | 'studio'): void {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* private mode */
  }
}

function freezeSession(session: Session): Session {
  return {
    ...session,
    tracks: session.tracks.map((track) => ({
      ...track,
      layers: track.layers.map((layer) => ({
        ...layer,
        transcribing: false,
        progress: layer.transcribing ? 0 : layer.progress,
        status: layer.transcribing ? 'Ready' : layer.status,
      })),
    })),
  }
}

function storeBuffer(buffer: AudioBuffer): StoredBuffer {
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(new Float32Array(buffer.getChannelData(c)))
  }
  return { sampleRate: buffer.sampleRate, channels }
}

function audioFromStored(stored: StoredBuffer): AudioBuffer {
  const length = stored.channels[0]?.length ?? 1
  const buffer = getAudioContext().createBuffer(
    Math.max(1, stored.channels.length),
    Math.max(1, length),
    stored.sampleRate || 44100,
  )
  stored.channels.forEach((channel, i) => {
    if (i >= buffer.numberOfChannels) return
    buffer.getChannelData(i).set(channel.subarray(0, buffer.length))
  })
  return buffer
}

function asF32(value: ArrayLike<number> | Float32Array | undefined): Float32Array {
  if (value instanceof Float32Array) return value
  return Float32Array.from(value ?? [])
}

function reviveAnalysis(raw: LayerAnalysis | FileAnalysis): LayerAnalysis {
  if (raw.kind === 'drums') {
    return {
      kind: 'drums',
      drums: {
        hop: raw.drums.hop,
        size: raw.drums.size,
        sampleRate: raw.drums.sampleRate,
        flux: asF32(raw.drums.flux),
      },
    }
  }
  return {
    kind: 'melody',
    melody: {
      times: asF32(raw.melody.times),
      freqs: asF32(raw.melody.freqs),
      probs: asF32(raw.melody.probs),
      energies: asF32(raw.melody.energies),
    },
  }
}

export function captureProject(session: Session, studio: StudioView, existing?: StoredProject): StoredProject {
  const buffers: Record<string, StoredBuffer> = {}
  const bufferForLayer: Record<string, string> = {}
  const analyses: Record<string, LayerAnalysis> = {}
  const seen = new Map<AudioBuffer, string>()

  for (const track of session.tracks) {
    for (const layer of track.layers) {
      const buffer = getLayerBuffer(layer.id)
      if (buffer) {
        let key = seen.get(buffer)
        if (!key) {
          key = layer.id
          seen.set(buffer, key)
          buffers[key] = storeBuffer(buffer)
        }
        bufferForLayer[layer.id] = key
      }
      const analysis = getLayerAnalysis(layer.id)
      if (analysis) analyses[layer.id] = analysis
    }
  }

  const now = Date.now()
  return {
    id: existing?.id ?? uid(),
    createdAt: existing?.createdAt ?? now,
    savedAt: now,
    session: freezeSession(session),
    studio,
    buffers,
    bufferForLayer,
    analyses,
  }
}

export function hydrateProject(project: StoredProject): void {
  clearAllLayerAudio()
  const restored = new Map<string, AudioBuffer>()
  for (const [key, stored] of Object.entries(project.buffers ?? {})) {
    if (!stored?.channels?.length) continue
    restored.set(key, audioFromStored(stored))
  }
  for (const [layerId, key] of Object.entries(project.bufferForLayer ?? {})) {
    const buffer = restored.get(key)
    if (buffer) setLayerBuffer(layerId, buffer)
  }
  for (const [id, analysis] of Object.entries(project.analyses ?? {})) {
    setLayerAnalysis(id, reviveAnalysis(analysis))
  }
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open sketch storage'))
  })
}

function reqOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Sketch storage failed'))
  })
}

export async function putProject(project: StoredProject): Promise<void> {
  const db = await idb()
  try {
    await reqOf(db.transaction(STORE, 'readwrite').objectStore(STORE).put(project))
  } finally {
    db.close()
  }
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
  const db = await idb()
  try {
    return await reqOf(db.transaction(STORE, 'readonly').objectStore(STORE).get(id))
  } finally {
    db.close()
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await idb()
  try {
    await reqOf(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  } finally {
    db.close()
  }
}

export async function listProjects(): Promise<SketchSummary[]> {
  const db = await idb()
  try {
    const all = await reqOf(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
    return (all as StoredProject[])
      .map((project) => ({
        id: project.id,
        title: project.session.meta.title || 'Untitled sketch',
        artist: project.session.meta.artist,
        bpm: project.session.meta.bpm,
        bars: project.session.meta.bars,
        tracks: project.session.tracks.length,
        savedAt: project.savedAt,
        createdAt: project.createdAt,
      }))
      .sort((a, b) => b.savedAt - a.savedAt)
  } finally {
    db.close()
  }
}

export async function loadCurrentProject(): Promise<StoredProject | undefined> {
  const id = readCurrentId()
  if (!id) return undefined
  try {
    return await getProject(id)
  } catch {
    return undefined
  }
}

function f32ToB64(data: Float32Array): string {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function b64ToF32(value: string): Float32Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

function analysisToFile(analysis: LayerAnalysis): FileAnalysis {
  if (analysis.kind === 'drums') {
    return {
      kind: 'drums',
      drums: {
        hop: analysis.drums.hop,
        size: analysis.drums.size,
        sampleRate: analysis.drums.sampleRate,
        flux: Array.from(analysis.drums.flux),
      },
    }
  }
  return {
    kind: 'melody',
    melody: {
      times: Array.from(analysis.melody.times),
      freqs: Array.from(analysis.melody.freqs),
      probs: Array.from(analysis.melody.probs),
      energies: Array.from(analysis.melody.energies),
    },
  }
}

export function projectToFile(project: StoredProject): ProjectFile {
  const buffers: Record<string, FileBuffer> = {}
  for (const [key, stored] of Object.entries(project.buffers)) {
    buffers[key] = {
      sampleRate: stored.sampleRate,
      channels: stored.channels.map(f32ToB64),
    }
  }
  const analyses: Record<string, FileAnalysis> = {}
  for (const [id, analysis] of Object.entries(project.analyses)) {
    analyses[id] = analysisToFile(analysis)
  }
  return {
    kind: 'songbird-studio',
    v: 1,
    id: project.id,
    createdAt: project.createdAt,
    savedAt: project.savedAt,
    session: project.session,
    studio: project.studio,
    buffers,
    bufferForLayer: project.bufferForLayer,
    analyses,
  }
}

export function fileToProject(raw: unknown): StoredProject {
  const file = raw as Partial<ProjectFile>
  if (file.kind !== 'songbird-studio' || file.v !== 1 || !file.session) {
    throw new Error('That file is not a SongBird sketch.')
  }
  const buffers: Record<string, StoredBuffer> = {}
  for (const [key, stored] of Object.entries(file.buffers ?? {})) {
    buffers[key] = {
      sampleRate: stored.sampleRate,
      channels: stored.channels.map(b64ToF32),
    }
  }
  const analyses: Record<string, LayerAnalysis> = {}
  for (const [id, analysis] of Object.entries(file.analyses ?? {})) {
    analyses[id] = reviveAnalysis(analysis)
  }
  return {
    id: file.id || uid(),
    createdAt: file.createdAt ?? Date.now(),
    savedAt: file.savedAt ?? Date.now(),
    session: file.session,
    studio: file.studio ?? defaultStudioView(file.session.meta.bpm, file.session.meta.bars),
    buffers,
    bufferForLayer: file.bufferForLayer ?? {},
    analyses,
  }
}

export function downloadProject(project: StoredProject): void {
  const json = JSON.stringify(projectToFile(project))
  const bytes = new TextEncoder().encode(json)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  const blob = new Blob([copy], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBase(project.session)}.songbird`
  a.click()
  URL.revokeObjectURL(url)
}

export function isPersistError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return 'This browser is out of space for sketches. Download a .songbird copy to keep the session.'
  }
  return err instanceof Error ? err.message : 'Could not save the sketch in this browser.'
}

export function sketchLooksKept(summary: SketchSummary): boolean {
  return summary.tracks > 0 || summary.title !== 'Untitled sketch' || Boolean(summary.artist)
}
