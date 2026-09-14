import type { StockShot } from '../types'

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function queriesFor(theme: string): string[] {
  const clean = theme.replace(/[^\p{L}\p{N}\s-]+/gu, ' ').trim()
  const base = clean || 'street photography people'
  return [
    `${base} people`,
    `${base} street`,
    `${base} city`,
    `${base} landscape`,
    `${base} filetype:video`,
    'people walking street photography',
  ]
}

type CommonsPage = {
  title?: string
  imageinfo?: {
    url?: string
    thumburl?: string
    mime?: string
    size?: number
    descriptionurl?: string
    extmetadata?: {
      Artist?: { value?: string }
      LicenseShortName?: { value?: string }
    }
  }[]
}

async function commonsSearch(query: string, limit: number): Promise<StockShot[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${query} -diagram -map -svg -icon -logo -flag -chart`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '1280',
  })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
  if (!res.ok) throw new Error('Could not reach Wikimedia Commons')
  const json = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } }
  const pages = Object.values(json.query?.pages ?? {})
  const out: StockShot[] = []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info?.url || !info.mime) continue
    const mime = info.mime
    const video = mime.startsWith('video/')
    const image = mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
    if (!video && !image) continue
    if ((info.size ?? 0) > 18_000_000) continue
    const url = info.thumburl && image ? info.thumburl : info.url
    out.push({
      url,
      thumb: info.thumburl || info.url,
      title: (page.title ?? 'Commons file').replace(/^File:/, ''),
      author: stripHtml(info.extmetadata?.Artist?.value || 'Wikimedia Commons'),
      mime,
      page: info.descriptionurl || 'https://commons.wikimedia.org/',
      kind: video ? 'video' : 'image',
    })
  }
  return out
}

export async function fetchThemeShots(theme: string): Promise<StockShot[]> {
  const seen = new Set<string>()
  const shots: StockShot[] = []
  const results = await Promise.allSettled(queriesFor(theme).map((q) => commonsSearch(q, 8)))
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const shot of result.value) {
      if (seen.has(shot.url)) continue
      seen.add(shot.url)
      shots.push(shot)
    }
  }
  shots.sort((a, b) => Number(b.kind === 'video') - Number(a.kind === 'video'))
  return shots.slice(0, 14)
}

export function loadShot(shot: StockShot): Promise<HTMLImageElement | HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    if (shot.kind === 'video') {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.preload = 'auto'
      video.onloadeddata = () => {
        void video.play().catch(() => undefined)
        resolve(video)
      }
      video.onerror = () => reject(new Error(shot.title))
      video.src = shot.url
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(shot.title))
    img.src = shot.url
  })
}
