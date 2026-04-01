"use client"

import { createLocalImportedSlideSource } from "@/features/decks/parse-slide-import"
import { uploadImageToSupabase } from "@/features/decks/supabase-image-upload"

const DB_NAME = "playdeck-imported-slides"
const STORE_NAME = "slides"
const DB_VERSION = 1
const IMPORTED_SLIDE_EVENT = "playdeck:imported-slide-change"

export type ImportedSlideUploadStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "failed"

export type StoredImportedSlideRecord = {
  id: string
  blob: Blob
  status: ImportedSlideUploadStatus
  remoteUrl: string | null
  lastError: string | null
  createdAt: number
  updatedAt: number
}

const uploadPromises = new Map<string, Promise<{ remoteUrl?: string; error?: string }>>()

function canUseIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined"
}

function emitImportedSlideChange(id: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(IMPORTED_SLIDE_EVENT, {
      detail: { id },
    }),
  )
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB."))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (!canUseIndexedDb()) {
    throw new Error("Imported slides require browser storage.")
  }

  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = fn(store)

    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."))
    request.onsuccess = () => resolve(request.result)
    tx.oncomplete = () => db.close()
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."))
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."))
  })
}

export async function createLocalImportedSlideRecord(
  blob: Blob,
): Promise<{ importId: string; src: string }> {
  const importId = crypto.randomUUID()
  const now = Date.now()
  const record: StoredImportedSlideRecord = {
    id: importId,
    blob,
    status: "pending",
    remoteUrl: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  }

  await withStore("readwrite", (store) => store.put(record))
  emitImportedSlideChange(importId)
  return {
    importId,
    src: createLocalImportedSlideSource(importId),
  }
}

export async function getImportedSlideRecord(
  id: string,
): Promise<StoredImportedSlideRecord | null> {
  if (!canUseIndexedDb()) return null
  const result = await withStore<StoredImportedSlideRecord | undefined>(
    "readonly",
    (store) => store.get(id),
  )
  return result ?? null
}

export async function updateImportedSlideRecord(
  id: string,
  patch: Partial<Omit<StoredImportedSlideRecord, "id" | "createdAt" | "blob">> & {
    blob?: Blob
  },
): Promise<StoredImportedSlideRecord | null> {
  const current = await getImportedSlideRecord(id)
  if (!current) return null

  const next: StoredImportedSlideRecord = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  }
  await withStore("readwrite", (store) => store.put(next))
  emitImportedSlideChange(id)
  return next
}

export function subscribeToImportedSlideChanges(
  listener: (importId: string) => void,
): () => void {
  if (typeof window === "undefined") return () => {}
  const onEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ id?: string }>
    const importId = customEvent.detail?.id
    if (typeof importId === "string" && importId !== "") {
      listener(importId)
    }
  }
  window.addEventListener(IMPORTED_SLIDE_EVENT, onEvent as EventListener)
  return () => {
    window.removeEventListener(IMPORTED_SLIDE_EVENT, onEvent as EventListener)
  }
}

export async function ensureImportedSlideUploaded(
  id: string,
): Promise<{ remoteUrl?: string; error?: string }> {
  if (uploadPromises.has(id)) {
    return uploadPromises.get(id)!
  }

  const promise = (async () => {
    const record = await getImportedSlideRecord(id)
    if (!record) {
      return { error: "Imported slide is not available on this device." }
    }
    if (record.remoteUrl) {
      return { remoteUrl: record.remoteUrl }
    }

    await updateImportedSlideRecord(id, {
      status: "uploading",
      lastError: null,
    })

    const result = await uploadImageToSupabase(record.blob, {
      profile: "imported-slide",
    })

    if ("error" in result) {
      await updateImportedSlideRecord(id, {
        status: "failed",
        lastError: result.error,
      })
      return { error: result.error }
    }

    await updateImportedSlideRecord(id, {
      status: "uploaded",
      remoteUrl: result.url,
      lastError: null,
    })
    return { remoteUrl: result.url }
  })()

  uploadPromises.set(id, promise)
  try {
    return await promise
  } finally {
    uploadPromises.delete(id)
  }
}

export async function preloadImportedSlideSrc(
  src: string,
): Promise<void> {
  if (typeof window === "undefined") return

  let resolvedUrl: string | null = null
  let revoke: (() => void) | null = null

  const localId = src.startsWith("local://") ? src.slice("local://".length) : null
  if (localId) {
    const record = await getImportedSlideRecord(localId)
    if (!record) return
    if (record.blob) {
      const objectUrl = URL.createObjectURL(record.blob)
      resolvedUrl = objectUrl
      revoke = () => URL.revokeObjectURL(objectUrl)
    } else if (record.remoteUrl) {
      resolvedUrl = record.remoteUrl
    }
  } else {
    resolvedUrl = src
  }

  if (!resolvedUrl) return

  await new Promise<void>((resolve) => {
    const image = new Image()
    image.decoding = "async"
    image.onload = () => {
      revoke?.()
      resolve()
    }
    image.onerror = () => {
      revoke?.()
      resolve()
    }
    image.src = resolvedUrl
  })
}
