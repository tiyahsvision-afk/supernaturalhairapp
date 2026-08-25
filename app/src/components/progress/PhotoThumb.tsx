import { useEffect, useState } from 'react'
import { getPhotoBlob } from '@/lib/photoStore'

export default function PhotoThumb({ photoId, alt }: { photoId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    getPhotoBlob(photoId).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoId])

  if (!url) {
    return <div className="aspect-square w-full animate-pulse rounded-2xl bg-ink-900/5" />
  }

  return <img src={url} alt={alt} className="aspect-square w-full rounded-2xl object-cover" />
}
