import type { ReactNode } from 'react'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
      <div>
        <h3 className="text-[13px] font-semibold tracking-wide text-slate-200 uppercase">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: 'slate' | 'green' | 'red' | 'indigo' | 'amber' | 'violet'
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-500/10 text-slate-300 ring-slate-400/20',
    green: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/25',
    red: 'bg-red-500/10 text-red-300 ring-red-400/25',
    indigo: 'bg-indigo-500/10 text-indigo-300 ring-indigo-400/25',
    amber: 'bg-amber-500/10 text-amber-300 ring-amber-400/25',
    violet: 'bg-violet-500/10 text-violet-300 ring-violet-400/25',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  className = '',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'accent'
  disabled?: boolean
  className?: string
  title?: string
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 disabled:bg-slate-700 disabled:shadow-none',
    accent:
      'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25 disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none',
    ghost:
      'bg-white/5 hover:bg-white/10 text-slate-200 ring-1 ring-inset ring-white/10 disabled:text-slate-500',
    danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-300 ring-1 ring-inset ring-red-400/25',
  }
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
