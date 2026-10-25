export function usd(value: number, digits = 0): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function pct(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function num(value: number, digits = 2): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function compact(value: number): string {
  return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })
}

/** "2026-01-01 02:45:00+00:00" -> 1767235500 */
export function tsToSeconds(ts: string): number {
  return Math.floor(new Date(ts.replace(' ', 'T')).getTime() / 1000)
}

/** Short label for chart axes / tables */
export function shortTs(ts: string): string {
  return ts.slice(5, 16).replace('T', ' ')
}

export const pnlColor = (v: number | null | undefined): string =>
  v == null ? 'text-slate-400' : v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-300'
