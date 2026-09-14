import type { Layer, MasterSettings, Session, VocalRole } from '../types'
import { selectedLayerOf } from '../types'
import { INSTRUMENTS } from '../data/instruments'

export type CommandResult = {
  message: string
  session?: Session
  exportFormat?: 'mp3' | 'wav' | 'midi'
}

function patchMaster(session: Session, patch: Partial<MasterSettings>): Session {
  return { ...session, master: { ...session.master, ...patch } }
}

function mapSelectedLayer(session: Session, patch: Partial<Layer>): Session {
  if (!session.selectedId) return session
  return {
    ...session,
    tracks: session.tracks.map((t) => {
      if (t.id !== session.selectedId) return t
      const layerId = selectedLayerOf(t)?.id
      return {
        ...t,
        layers: t.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      }
    }),
  }
}

const ROLES: VocalRole[] = ['lead', 'verse', 'chorus', 'double', 'harmony']

export function interpretCommand(raw: string, session: Session): CommandResult {
  const q = raw.trim().toLowerCase()
  if (!q) return { message: 'Tell me what to do — fix EQ, master, export mp3…' }

  let next = session
  const notes: string[] = []
  let exportFormat: CommandResult['exportFormat']

  if (/fix\s*eq|auto\s*eq|eq\s*(this|it|the\s+song)?/.test(q)) {
    next = patchMaster(next, { autoEq: true, presence: 1.4, high: 1.6, low: 0.4 })
    notes.push('Applied a corrective EQ curve (high-pass rumble, lifted presence, tamed mud).')
  }

  if (/master|loudness|limit|make it loud/.test(q)) {
    next = patchMaster(next, { glue: 0.7, limiter: 0.95, inputGain: 1.5, autoEq: true })
    notes.push('Mastered: glue compression + limiter aimed at streaming loudness.')
  }

  if (/brighter|more air|treble/.test(q)) {
    next = patchMaster(next, { high: Math.min(6, next.master.high + 2) })
    notes.push('Opened the top end.')
  }
  if (/darker|duller|less harsh/.test(q)) {
    next = patchMaster(next, { high: Math.max(-4, next.master.high - 2) })
    notes.push('Rolled off the highs.')
  }
  if (/more bass|bassier|low end/.test(q)) {
    next = patchMaster(next, { low: Math.min(6, next.master.low + 2.5) })
    notes.push('Added weight in the low end.')
  }
  if (/punch|punchier drums/.test(q)) {
    next = {
      ...next,
      tracks: next.tracks.map((t) =>
        t.kind === 'drums'
          ? {
              ...t,
              layers: t.layers.map((l) => ({
                ...l,
                eq: { ...l.eq, low: l.eq.low + 2, presence: l.eq.presence + 1.5 },
              })),
            }
          : t,
      ),
    }
    notes.push('Pushed kick and snare punch.')
  }

  if (/widen|wider vocal|chorus/.test(q) && /vocal|voice|sing|chorus/.test(q)) {
    next = mapSelectedLayer(next, { vocalRole: 'chorus' })
    notes.push('Set the vocal layer to a chorus stack (wider doubles + hall).')
  }

  for (const role of ROLES) {
    if (new RegExp(`\\b${role}\\b`).test(q) && /vocal|voice|sing/.test(q)) {
      next = mapSelectedLayer(next, { vocalRole: role })
      notes.push(`Vocal role is now ${role}.`)
    }
  }

  for (const inst of INSTRUMENTS.filter((i) => i.kind === 'melody')) {
    const token = inst.label.toLowerCase()
    if (q.includes(token) || q.includes(inst.id.replace('-', ' '))) {
      next = mapSelectedLayer(next, { instrumentId: inst.id })
      notes.push(`Selected ${inst.label} on this layer.`)
      break
    }
  }
  if (/piano/.test(q) && !notes.some((n) => /Selected/.test(n))) {
    next = mapSelectedLayer(next, { instrumentId: 'piano' })
    notes.push('Mapped this layer to concert piano.')
  }
  if (/(guitar|hum)/.test(q) && /steel|acoustic|guitar/.test(q)) {
    next = mapSelectedLayer(next, { instrumentId: 'steel' })
    notes.push('Mapped this layer to steel guitar.')
  }

  if (/quantize|on the grid|tighten timing/.test(q)) {
    next = {
      ...next,
      tracks: next.tracks.map((t) => ({
        ...t,
        layers: t.layers.map((l) => ({ ...l, quantize: 0.85 })),
      })),
    }
    notes.push('Snapped timing toward the grid, keeping some feel.')
  }
  if (/human|feel|don't quantize|intention|emotion/.test(q)) {
    next = {
      ...next,
      tracks: next.tracks.map((t) => ({
        ...t,
        layers: t.layers.map((l) => ({ ...l, quantize: 0 })),
      })),
    }
    notes.push('Kept original timing so the performance feel stays intact.')
  }

  if (/(chord|triad|seventh|harmony voicing|not solo)/.test(q)) {
    next = mapSelectedLayer(next, { voicing: /7|seventh/.test(q) ? 'sevenths' : /power/.test(q) ? 'power' : 'triads' })
    notes.push('Voiced this melody as chords in the session key. Pick Solo in the inspector for a single line.')
  }

  if (/sync|in time|together|same beat/.test(q)) {
    notes.push('Use Make layers in sync in the inspector — it puts every take on the same loop and click.')
  }

  if (/solo|isolate/.test(q)) {
    notes.push('Use S on a mixer layer to isolate it — Play keeps all layers loaded so solo is instant.')
  }

  if (/export|bounce|download/.test(q)) {
    if (/midi/.test(q)) exportFormat = 'midi'
    else if (/wav/.test(q)) exportFormat = 'wav'
    else exportFormat = 'mp3'
    notes.push(`Ready to export ${exportFormat.toUpperCase()} with title and artist tags.`)
  }

  if (!notes.length) {
    return {
      message:
        'I can fix EQ, master, brighten/darken, punch drums, switch instruments, set vocal roles, quantize, or export MP3/WAV/MIDI.',
    }
  }

  return { message: notes.join(' '), session: next, exportFormat }
}
