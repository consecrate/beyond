/** Dedicated Jazz anonymous credential namespace for /join (avoids clashing with presenter tab). */
export const JOIN_VIEWER_AUTH_SECRET_STORAGE_KEY = "playdeck-join-viewer"

/** How long a resumed viewer session stays valid before forced re-join. */
export const JOIN_VIEWER_SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000

const ACTIVE_SESSION_KEY = "playdeck-active-session"
const SESSION_STARTED_AT_KEY = "playdeck-join-session-started-at"

function safeParseStartedAt(raw: string | null): number | null {
  if (raw == null || raw === "") return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function readStoredJoinSessionId(): string | null {
  if (typeof localStorage === "undefined") return null
  const v = localStorage.getItem(ACTIVE_SESSION_KEY)?.trim()
  return v && v.length > 0 ? v : null
}

export function readJoinSessionStartedAt(): number | null {
  if (typeof localStorage === "undefined") return null
  return safeParseStartedAt(localStorage.getItem(SESSION_STARTED_AT_KEY))
}

export function isJoinSessionExpired(startedAt: number): boolean {
  return Date.now() - startedAt > JOIN_VIEWER_SESSION_TTL_MS
}

export function saveJoinViewerSessionResume(sessionId: string): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId)
  localStorage.setItem(SESSION_STARTED_AT_KEY, String(Date.now()))
}

export function clearJoinViewerSessionStorage(): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(ACTIVE_SESSION_KEY)
  localStorage.removeItem(SESSION_STARTED_AT_KEY)
}
