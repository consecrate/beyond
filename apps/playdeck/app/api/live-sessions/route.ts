import { Redis } from "@upstash/redis"
import { NextRequest, NextResponse } from "next/server"

const TTL_SECONDS = 24 * 60 * 60

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function kvKeyCode(code: string): string {
  return `live:code:${code.toUpperCase()}`
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url?.trim() || !token?.trim()) return null
  return new Redis({ url: url.trim(), token: token.trim() })
}

type MemEntry = { sessionId: string; expiresAt: number }
const memStore = new Map<string, MemEntry>()

function memPrune(): void {
  const now = Date.now()
  for (const [k, v] of memStore) {
    if (v.expiresAt < now) memStore.delete(k)
  }
}

function memSet(code: string, sessionId: string): boolean {
  memPrune()
  const upper = code.toUpperCase()
  if (memStore.has(upper)) return false
  memStore.set(upper, {
    sessionId,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  })
  return true
}

function memGet(code: string): string | null {
  memPrune()
  const e = memStore.get(code.toUpperCase())
  if (!e) return null
  if (e.expiresAt < Date.now()) {
    memStore.delete(code.toUpperCase())
    return null
  }
  return e.sessionId
}

function memDel(code: string): void {
  memStore.delete(code.toUpperCase())
}

function generateCode(): string {
  const len = 6
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length]!
  }
  return out
}

function normalizeCode(raw: string): string | null {
  const t = raw.trim().toUpperCase()
  if (t.length < 4 || t.length > 8) return null
  if (!/^[A-Z0-9]+$/.test(t)) return null
  return t
}

/** Register a short join code for a Jazz LiveSession id (TTL applies). */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { sessionId?: unknown }).sessionId !== "string"
  ) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const sessionId = (body as { sessionId: string }).sessionId.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const redis = getRedis()

  for (let attempt = 0; attempt < 24; attempt++) {
    const code = generateCode()

    if (redis) {
      const key = kvKeyCode(code)
      const ok = await redis.set(key, sessionId, {
        ex: TTL_SECONDS,
        nx: true,
      })
      if (ok != null) {
        return NextResponse.json({ code, sessionId, ttlSeconds: TTL_SECONDS })
      }
    } else {
      if (memSet(code, sessionId)) {
        return NextResponse.json({ code, sessionId, ttlSeconds: TTL_SECONDS })
      }
    }
  }

  return NextResponse.json({ error: "Could not allocate a code" }, { status: 503 })
}

/** Resolve join code → Jazz LiveSession id. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("code")
  if (!raw) {
    return NextResponse.json({ error: "code query is required" }, { status: 400 })
  }

  const code = normalizeCode(raw)
  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  const redis = getRedis()

  if (redis) {
    const sessionId = await redis.get<string>(kvKeyCode(code))
    if (sessionId === null || sessionId === undefined) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ sessionId })
  }

  const sessionId = memGet(code)
  if (!sessionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ sessionId })
}

/** Remove mapping for a join code (e.g. when the presenter ends the session). */
export async function DELETE(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("code")
  if (!raw) {
    return NextResponse.json({ error: "code query is required" }, { status: 400 })
  }

  const code = normalizeCode(raw)
  if (!code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  const redis = getRedis()
  if (redis) {
    await redis.del(kvKeyCode(code))
  } else {
    memDel(code)
  }

  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { oldCode?: unknown }).oldCode !== "string" ||
    typeof (body as { newCode?: unknown }).newCode !== "string" ||
    typeof (body as { sessionId?: unknown }).sessionId !== "string"
  ) {
    return resError("oldCode, newCode, and sessionId are required as strings", 400)
  }

  function resError(msg: string, status: number) {
    return NextResponse.json({ error: msg }, { status })
  }

  const { oldCode, newCode, sessionId } = body as { oldCode: string; newCode: string; sessionId: string }

  const normalizedOld = normalizeCode(oldCode)
  const normalizedNew = normalizeCode(newCode)
  if (!normalizedOld || !normalizedNew) {
    return resError("Invalid code format (must be 4-8 alphanumeric characters)", 400)
  }

  if (!sessionId.trim()) {
    return resError("sessionId is required", 400)
  }

  const redis = getRedis()

  if (redis) {
    // Attempt to set the new code via NX
    const ok = await redis.set(kvKeyCode(normalizedNew), sessionId, {
      ex: TTL_SECONDS,
      nx: true,
    })
    if (!ok) {
      return resError("Code is already in use", 409)
    }

    // Delete the old code mapping if it's different
    if (normalizedOld !== normalizedNew) {
      await redis.del(kvKeyCode(normalizedOld))
    }

    return NextResponse.json({ code: normalizedNew })
  } else {
    if (normalizedOld !== normalizedNew) {
      if (!memSet(normalizedNew, sessionId)) {
        return resError("Code is already in use", 409)
      }
      memDel(normalizedOld)
    }
    return NextResponse.json({ code: normalizedNew })
  }
}
