import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI, openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

import {
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULT_CHAT_MODEL,
} from "@/lib/openrouter-config"

export type ChatProviderId = "openrouter" | "google" | "openai"

/**
 * Central switch: change this to pick which backend session chat uses.
 * API keys stay in `.env` (see `.env.example`).
 */
export const ACTIVE_CHAT_PROVIDER: ChatProviderId = "google"

/** Default when `GOOGLE_GENERATIVE_AI_CHAT_MODEL` is unset. */
export const GOOGLE_DEFAULT_CHAT_MODEL = "gemini-3-flash-preview"

export type ResolveChatModelResult =
  | { ok: true; model: LanguageModel }
  | { ok: false; message: string }

export function resolveChatModel(): ResolveChatModelResult {
  switch (ACTIVE_CHAT_PROVIDER) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY?.trim()
      if (!apiKey) {
        return {
          ok: false,
          message:
            "Server missing OPENROUTER_API_KEY (ACTIVE_CHAT_PROVIDER is openrouter in lib/ai-chat-config.ts)",
        }
      }
      const referer = process.env.OPENROUTER_HTTP_REFERER?.trim()
      const modelId =
        process.env.OPENROUTER_CHAT_MODEL?.trim() ||
        OPENROUTER_DEFAULT_CHAT_MODEL
      const model = createOpenAI({
        apiKey,
        baseURL: OPENROUTER_BASE_URL,
        name: "openrouter",
        ...(referer
          ? {
              headers: {
                "HTTP-Referer": referer,
                "X-Title": "Firstly",
              },
            }
          : {}),
      }).chat(modelId)
      return { ok: true, model }
    }
    case "google": {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
      if (!apiKey) {
        return {
          ok: false,
          message:
            "Server missing GOOGLE_GENERATIVE_AI_API_KEY (ACTIVE_CHAT_PROVIDER is google in lib/ai-chat-config.ts)",
        }
      }
      const modelId =
        process.env.GOOGLE_GENERATIVE_AI_CHAT_MODEL?.trim() ||
        GOOGLE_DEFAULT_CHAT_MODEL
      const google = createGoogleGenerativeAI({ apiKey })
      return { ok: true, model: google.chat(modelId) }
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY?.trim()
      if (!apiKey) {
        return {
          ok: false,
          message:
            "Server missing OPENAI_API_KEY (ACTIVE_CHAT_PROVIDER is openai in lib/ai-chat-config.ts)",
        }
      }
      const modelId = process.env.OPENAI_CHAT_MODEL?.trim() ?? "gpt-4o-mini"
      return { ok: true, model: openai(modelId) }
    }
  }
}
