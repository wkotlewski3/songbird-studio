export type ArmedRecorder = {
  start: () => void
  stop: () => Promise<Blob>
  cancel: () => void
}

export async function armRecorder(): Promise<ArmedRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : ''
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }

  const release = () => {
    stream.getTracks().forEach((t) => t.stop())
  }

  return {
    start: () => {
      if (rec.state === 'inactive') rec.start(50)
    },
    stop: () =>
      new Promise((resolve, reject) => {
        if (rec.state === 'inactive') {
          release()
          resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
          return
        }
        rec.onerror = () => {
          release()
          reject(new Error('Recording failed'))
        }
        rec.onstop = () => {
          release()
          resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
        }
        rec.stop()
      }),
    cancel: () => {
      try {
        if (rec.state !== 'inactive') rec.stop()
      } catch {
        /* already stopped */
      }
      release()
    },
  }
}
