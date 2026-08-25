interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: SectionHeadingProps) {
  return (
    <div className={align === 'center' ? 'text-center mx-auto max-w-2xl' : ''}>
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-300">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
        <span className="text-gradient">{title}</span>
      </h2>
      {description && <p className="mt-3 text-white/70">{description}</p>}
    </div>
  )
}
