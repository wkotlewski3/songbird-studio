export function BirdMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#12131a" />
      <path
        d="M14 40c8-2 14-10 16-18 6 8 16 12 26 10-8 4-14 12-16 20-8-10-18-12-26-12z"
        fill="#e8b86d"
      />
      <circle cx="24" cy="26" r="2" fill="#0b0c10" />
    </svg>
  )
}
