import type { MasterSettings, Session, Track, VocalRole } from '../types'
import { INSTRUMENTS } from '../data/instruments'

export type CommandResult = {
  message: string
  session?: Session
  exportFormat?: 'mp3' | 'wav' | 'midi'
}

function patchMaster(session: Session, patch: Partial<MasterSettings>): Session {
  return { ...session, master: { ...session.master, ...patch } }
}

function patchSelected(session: Session, patch: Partial<Track>): Session {
  if (!session.selectedId) return session
  return {
    ...session,
    tracks: session.tracks.map((t) => (t.id === session.selectedId ? { ...t, ...patch } : t)),
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
        t.kind === 'drums' ? { ...t, eq: { ...t.eq, low: t.eq.low + 2, presence: t.eq.presence + 1.5 } } : t,
      ),
    }
    notes.push('Pushed kick and snare punch.')
  }

  if (/widen|wider vocal|chorus/.test(q) && /vocal|voice|sing|chorus/.test(q)) {
    next = patchSelected(next, { vocalRole: 'chorus' })
    notes.push('Set the vocal to a chorus stack (wider doubles + hall).')
  }

  for (const role of ROLES) {
    if (new RegExp(`\\b${role}\\b`).test(q) && /vocal|voice|sing/.test(q)) {
      next = patchSelected(next, { vocalRole: role })
      notes.push(`Vocal role is now ${role}.`)
    }
  }

  for (const inst of INSTRUMENTS.filter((i) => i.kind === 'melody')) {
    const token = inst.label.toLowerCase()
    if (q.includes(token) || q.includes(inst.id.replace('-', ' '))) {
      next = patchSelected(next, { instrumentId: inst.id })
      notes.push(`Selected ${inst.label}.`)
      break
    }
  }
  if (/piano/.test(q) && !notes.some((n) => /Selected/.test(n))) {
    next = patchSelected(next, { instrumentId: 'piano' })
    notes.push('Mapped the melody to concert piano.')
  }
  if (/(guitar|hum)/.test(q) && /steel|acoustic|guitar/.test(q)) {
    next = patchSelected(next, { instrumentId: 'steel' })
    notes.push('Mapped the melody to steel guitar.')
  }

  if (/quantize|on the grid|tighten timing/.test(q)) {
    next = {
      ...next,
      tracks: next.tracks.map((t) => ({ ...t, quantize: 0.85 })),
    }
    notes.push('Snapped timing toward the grid, keeping some feel.')
  }
  if (/human|feel|don't quantize|intention|emotion/.test(q)) {
    next = {
      ...next,
      tracks: next.tracks.map((t) => ({ ...t, quantize: 0 })),
    }
    notes.push('Kept original timing so the performance feel stays intact.')
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
