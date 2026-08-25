export default function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-white">
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-sky-400 glow-blob animate-float-slow" />
      <div
        className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-400 glow-blob animate-float-slow"
        style={{ animationDelay: '2s' }}
      />
      <div
        className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-lavender-400 glow-blob animate-float-slow"
        style={{ animationDelay: '4s' }}
      />
    </div>
  )
}
