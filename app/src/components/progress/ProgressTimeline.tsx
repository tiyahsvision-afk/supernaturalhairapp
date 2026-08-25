import GlowCard from '@/components/layout/GlowCard'
import PhotoThumb from './PhotoThumb'
import { formatFriendlyDate } from '@/lib/date'
import { deletePhotoBlob } from '@/lib/photoStore'
import { useAppStore } from '@/store/useAppStore'

export default function ProgressTimeline() {
  const photos = useAppStore((s) => s.photos)
  const removePhoto = useAppStore((s) => s.removePhoto)

  if (photos.length === 0) {
    return (
      <GlowCard>
        <p className="text-sm text-white/60">
          No progress photos yet. Add your first one above to start your timeline.
        </p>
      </GlowCard>
    )
  }

  async function handleDelete(id: string) {
    await deletePhotoBlob(id)
    removePhoto(id)
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative">
          <PhotoThumb photoId={photo.id} alt={photo.note || `Progress photo ${photo.date}`} />
          <button
            onClick={() => handleDelete(photo.id)}
            className="absolute right-2 top-2 hidden h-7 w-7 place-items-center rounded-full bg-ink-950/80 text-xs text-white group-hover:grid"
            aria-label="Delete photo"
          >
            ✕
          </button>
          <p className="mt-1.5 text-xs font-medium text-white/70">{formatFriendlyDate(photo.date)}</p>
          {photo.note && <p className="truncate text-xs text-white/40">{photo.note}</p>}
        </div>
      ))}
    </div>
  )
}
