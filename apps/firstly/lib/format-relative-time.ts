const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
]

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

export function formatRelativeTimeShort(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffSec = (then - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  for (const [unit, span] of UNITS) {
    if (abs >= span || unit === "second") {
      return rtf.format(Math.round(diffSec / span), unit)
    }
  }
  return rtf.format(0, "second")
}
