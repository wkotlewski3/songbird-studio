export interface TimedWord {
  text: string
  start: number
  end: number
}

export interface TimedLine {
  text: string
  start: number
  end: number
  words: TimedWord[]
}

export function timeLyrics(lyrics: string, duration: number, title: string): TimedLine[] {
  const raw = lyrics
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const lines = raw.length ? raw : [title || 'Sing along']
  const span = Math.max(0.8, duration / lines.length)
  return lines.map((text, i) => {
    const start = i * span
    const end = i === lines.length - 1 ? duration : (i + 1) * span
    const tokens = text.split(/\s+/).filter(Boolean)
    const wordSpan = (end - start) / Math.max(1, tokens.length)
    const words = tokens.map((word, w) => ({
      text: word,
      start: start + w * wordSpan,
      end: start + (w + 1) * wordSpan,
    }))
    return { text, start, end, words }
  })
}

export function lineAt(lines: TimedLine[], time: number): { line: TimedLine; next: TimedLine | null; word: TimedWord | null } {
  const line = lines.find((l) => time >= l.start && time < l.end) ?? lines[lines.length - 1]
  const next = lines[lines.indexOf(line) + 1] ?? null
  const word = line.words.find((w) => time >= w.start && time < w.end) ?? line.words[line.words.length - 1] ?? null
  return { line, next, word }
}
