import { useRef, useState } from 'react'
import GlowCard from '@/components/layout/GlowCard'
import { todayKey } from '@/lib/date'
import { savePhotoBlob } from '@/lib/photoStore'
import { useAppStore } from '@/store/useAppStore'

export default function PhotoUploadForm() {
  const addPhoto = useAppStore((s) => s.addPhoto)
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  function handleFile(f: File | undefined) {
    if (!f) return
    setFile(f)
    setSaved(false)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!file) return
    const record = addPhoto({ date, note: note.trim() })
    await savePhotoBlob(record.id, file)
    setSaved(true)
    setFile(null)
    setPreview(null)
    setNote('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <GlowCard>
      <h3 className="font-display text-lg font-bold text-white">Add a progress photo</h3>
      <p className="mt-1 text-sm text-white/60">
        Daily or weekly — whatever works for you. Photos are stored privately in this browser.
      </p>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row">
        <label className="flex aspect-square w-full max-w-[180px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-white/5 hover:border-fuchsia-300/50">
          {preview ? (
            <img src={preview} alt="Selected preview" className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-white/50">📷 Tap to take or choose a photo</span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        <div className="flex-1 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60" htmlFor="photo-date">
              Date
            </label>
            <input
              id="photo-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60" htmlFor="photo-note">
              Note (optional)
            </label>
            <input
              id="photo-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Week 6 — length check"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-300"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!file}
            className="w-full rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 py-2.5 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {saved ? '✓ Saved — +50 pts earned' : 'Save to my timeline'}
          </button>
        </div>
      </div>
    </GlowCard>
  )
}
