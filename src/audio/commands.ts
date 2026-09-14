import type { Layer, MasterSettings, Session, VideoFilter, VideoSettings, VocalEcho, VocalReverb, VocalRole } from '../types'
import { defaultVideo, selectedLayerOf } from '../types'
import { INSTRUMENTS } from '../data/instruments'

export type CommandResult = {
  message: string
  session?: Session
  exportFormat?: 'mp3' | 'wav' | 'midi'
  openVideo?: boolean
  generateVideo?: boolean
}

function patchVideo(session: Session, patch: Partial<VideoSettings>): Session {
  return { ...session, video: { ...(session.video ?? defaultVideo()), ...patch } }
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
  let openVideo = false
  let generateVideo = false

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

  if (/widen|wider vocal|chorus stack/.test(q) && /vocal|voice|sing|chorus/.test(q)) {
    next = mapSelectedLayer(next, { vocalRole: 'chorus', vocalTone: 'airy', vocalReverb: 'hall', vocalEcho: 'slap' })
    notes.push('Set the vocal to a chorus stack (wider doubles + hall).')
  }

  if (/(crisp|studio)\s*(lead|vocal|voice)|record[- ]ready vocal|dry lead/.test(q)) {
    next = mapSelectedLayer(next, { vocalRole: 'lead', vocalTone: 'studio', vocalReverb: 'room', vocalEcho: 'off' })
    notes.push('Studio lead: crisp, de-essed, tight room, no echo.')
  }
  if (/\bradio\b/.test(q) && /vocal|voice|sing/.test(q)) {
    next = mapSelectedLayer(next, { vocalTone: 'radio' })
    notes.push('Radio vocal tone — mid-forward lo-fi band.')
  }
  if (/\bwarm\b/.test(q) && /vocal|voice|verse/.test(q)) {
    next = mapSelectedLayer(next, { vocalTone: 'warm', vocalReverb: 'dry', vocalEcho: 'off' })
    notes.push('Warm, close vocal.')
  }

  const reverbs: [RegExp, VocalReverb, string][] = [
    [/\bcathedral|church|ambient wash\b/, 'cathedral', 'Cathedral vocal reverb.'],
    [/\bhall\b/, 'hall', 'Hall vocal reverb.'],
    [/\bplate\b/, 'plate', 'Plate vocal reverb.'],
    [/\btight room|booth\b/, 'room', 'Tight room on the vocal.'],
    [/\bdry\b.*\b(reverb|space|vocal)|no reverb\b/, 'dry', 'Dried the vocal reverb.'],
  ]
  for (const [re, id, msg] of reverbs) {
    if (re.test(q) && /vocal|voice|sing|reverb|space/.test(q)) {
      next = mapSelectedLayer(next, { vocalReverb: id })
      notes.push(msg)
      break
    }
  }

  const echoes: [RegExp, VocalEcho, string][] = [
    [/ping[- ]?pong/, 'pingpong', 'Ping-pong vocal echo.'],
    [/\bdub\b/, 'dub', 'Dub vocal echo — darker dotted-eights.'],
    [/1\/4|quarter echo|quarter[- ]note echo/, 'quarter', 'Quarter-note vocal echo on this BPM.'],
    [/1\/8|eighth echo|eighth[- ]note echo/, 'eighth', 'Eighth-note vocal echo on this BPM.'],
    [/\bslap(back)?\b/, 'slap', 'Slapback on the vocal.'],
    [/no echo|echo off/, 'off', 'Turned vocal echo off.'],
  ]
  for (const [re, id, msg] of echoes) {
    if (re.test(q) && /vocal|voice|sing|echo|delay|slap|dub/.test(q)) {
      next = mapSelectedLayer(next, { vocalEcho: id })
      notes.push(msg)
      break
    }
  }
  if (/echo|delay/.test(q) && /vocal|voice|sing/.test(q) && !notes.some((n) => /echo|Slap|Dub|Ping/.test(n))) {
    next = mapSelectedLayer(next, { vocalEcho: 'eighth' })
    notes.push('Eighth-note vocal echo on this BPM.')
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

  const lyricChunk = raw.match(/lyrics\s*[:\-]\s*([\s\S]+)/i)
  if (lyricChunk) {
    next = patchVideo(next, { lyrics: lyricChunk[1].trim(), showWords: true })
    notes.push('Lyrics are on the film — current word lights gold.')
    openVideo = true
  }

  const themeChunk = raw.match(/(?:video about|film about|theme[:\s]+)\s*(.+)$/i)
  if (themeChunk) {
    const theme = themeChunk[1].replace(/\s+with\s+lyrics[\s\S]*$/i, '').trim()
    if (theme) {
      next = patchVideo(next, { theme, stock: [] })
      notes.push(`Theme is “${theme}”. Pulling open shots into a lyric film.`)
      openVideo = true
      generateVideo = true
    }
  }

  if (/music video|lyric video|make a video|generate (the )?film|generate (the )?video/.test(q)) {
    openVideo = true
    generateVideo = true
    if (!notes.length) notes.push('Opening the lyric film desk. Type a theme if it is empty, then generate.')
  }

  if (/new shots|different (shots|pictures|footage)|reshuffle/.test(q)) {
    next = patchVideo(next, { stock: [] })
    openVideo = true
    generateVideo = true
    notes.push('Fetching a new round of Wikimedia shots for this theme.')
  }

  const filters: [RegExp, VideoFilter, string][] = [
    [/black and white|\bbw\b|\bchrome\b/, 'chrome', 'Chrome — high-contrast black and white.'],
    [/\bvhs\b|scanline/, 'vhs', 'VHS filter on the film.'],
    [/dream|soft|bloom/, 'dream', 'Dreamy bloom on the film.'],
    [/golden|warmer|gold wash/, 'golden', 'Golden wash on the film.'],
    [/colder|night filter|\bnight\b/, 'night', 'Night filter — cool and crushed.'],
    [/\bfilm\b grain|\bfilm look\b/, 'film', 'Warm film grain.'],
  ]
  for (const [re, id, msg] of filters) {
    if (re.test(q) && /video|film|filter|look|grade/.test(q)) {
      next = patchVideo(next, { filter: id })
      openVideo = true
      notes.push(msg)
      break
    }
  }

  if (/bigger (words|lyrics)|larger lyrics/.test(q)) {
    next = patchVideo(next, { lyricScale: Math.min(1.6, (next.video?.lyricScale ?? 1) + 0.15), showWords: true })
    openVideo = true
    notes.push('Lyrics are larger on the film.')
  }
  if (/smaller (words|lyrics)/.test(q)) {
    next = patchVideo(next, { lyricScale: Math.max(0.7, (next.video?.lyricScale ?? 1) - 0.15), showWords: true })
    openVideo = true
    notes.push('Lyrics are smaller on the film.')
  }
  if (/faster cuts|quicker cuts|cut every beat/.test(q)) {
    next = patchVideo(next, { cutBeats: 1 })
    openVideo = true
    notes.push('Cuts every beat.')
  }
  if (/slower cuts|hold the shots/.test(q)) {
    next = patchVideo(next, { cutBeats: 8 })
    openVideo = true
    notes.push('Cuts every 8 beats — shots hold longer.')
  }
  if (/hide lyrics|no lyrics on screen/.test(q)) {
    next = patchVideo(next, { showWords: false })
    openVideo = true
    notes.push('Words are off the picture.')
  }
  if (/show lyrics|sing along/.test(q)) {
    next = patchVideo(next, { showWords: true })
    openVideo = true
    notes.push('Words stay on screen for sing-along.')
  }
  if (/include me|cut me in|use my (camera|tape|screen)/.test(q)) {
    next = patchVideo(next, { useSelf: true })
    openVideo = true
    notes.push('Your tapes will cut in. Record me or Record screen in the film desk.')
  }
  if (/no camera|without me|stock only/.test(q) && /video|film/.test(q)) {
    next = patchVideo(next, { useSelf: false })
    openVideo = true
    notes.push('Film will stay on the open shots only.')
  }

  if (/solo|isolate/.test(q)) {
    notes.push('Use S on a mixer layer to isolate it — Play keeps all layers loaded so solo is instant.')
  }

  if (/(export|bounce|download)/.test(q) && !/video|film|webm/.test(q)) {
    if (/midi/.test(q)) exportFormat = 'midi'
    else if (/wav/.test(q)) exportFormat = 'wav'
    else exportFormat = 'mp3'
    notes.push(`Ready to export ${exportFormat.toUpperCase()} with title and artist tags.`)
  }
  if (/download/.test(q) && /video|film|webm/.test(q)) {
    openVideo = true
    notes.push('Lyric film desk is open — hit Download WebM after the picture looks right.')
  }

  if (!notes.length) {
    return {
      message:
        'I can fix EQ, master, brighten/darken, punch drums, switch instruments, set vocal tone/reverb/echo, make a lyric film from a theme, or export MP3/WAV/MIDI.',
    }
  }

  return { message: notes.join(' '), session: next, exportFormat, openVideo, generateVideo }
}
