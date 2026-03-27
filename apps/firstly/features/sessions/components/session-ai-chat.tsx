"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button, Textarea, cn } from "@beyond/design-system"

type Props = {
  sessionId: string
  className?: string
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent underline underline-offset-2 hover:opacity-90"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const inline = !className
    return inline ? (
      <code
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs font-mono leading-relaxed">
      {children}
    </pre>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 align-top">{children}</td>
  ),
}

function ChatMarkdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  if (!children) return null
  return (
    <div className={cn("min-w-0 text-sm leading-relaxed", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function MessageBubble({
  message,
  showStreamingCursor,
}: {
  message: UIMessage
  showStreamingCursor: boolean
}) {
  const isUser = message.role === "user"
  const text = messageText(message)
  const hasToolParts = message.parts.some((p) =>
    String(p.type).startsWith("tool-"),
  )

  return (
    <div
      className={cn("flex w-full min-w-0", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1.5 text-sm",
          isUser
            ? "max-w-[min(85%,24rem)] rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            : "w-full text-foreground",
        )}
      >
        {text ? (
          <div className="flex min-w-0 flex-row items-start gap-1">
            <div className="min-w-0 flex-1">
              <ChatMarkdown>{text}</ChatMarkdown>
            </div>
            {showStreamingCursor ? (
              <span
                className="mt-0.5 inline-block h-4 w-0.5 shrink-0 animate-pulse rounded-sm bg-foreground"
                aria-hidden
              />
            ) : null}
          </div>
        ) : null}
        {hasToolParts ? (
          <div
            className={cn(
              "text-xs text-muted-foreground",
              isUser && "opacity-90",
            )}
          >
            {message.parts
              .filter((p) => String(p.type).startsWith("tool-"))
              .map((p, i) => (
                <div key={i} className="font-mono tabular-nums">
                  {String(p.type)}
                </div>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function SessionAiChat({ sessionId, className }: Props) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/sessions/${sessionId}/chat`,
      }),
    [sessionId],
  )

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
    onFinish: () => {
      router.refresh()
    },
  })

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: status === "streaming" ? "instant" : "smooth",
        block: "end",
      })
    })
    return () => cancelAnimationFrame(id)
  }, [messages, status])

  const busy = status === "streaming" || status === "submitted"

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-card",
        className,
      )}
    >
      <div
        className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask the agent to add lessons, edit titles or goals, or reorganize
            prerequisites on the skill tree (add, remove, or replace edges).
          </p>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              showStreamingCursor={
                status === "streaming" &&
                i === messages.length - 1 &&
                m.role === "assistant"
              }
            />
          ))
        )}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>

      {error ? (
        <p className="border-t border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error.message}
        </p>
      ) : null}

      <form
        className="shrink-0 border-t border-border"
        onSubmit={async (e) => {
          e.preventDefault()
          const t = input.trim()
          if (!t || busy) return
          setInput("")
          await sendMessage({ text: t })
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. add a lesson on fractions, then put it before algebra…"
          rows={2}
          disabled={busy}
          className={cn(
            "min-h-13 resize-none rounded-none border-0 bg-transparent px-3 py-2.5 text-sm",
            "shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground/75",
          )}
        />
        <div className="flex items-center justify-end gap-2 px-2 py-2">
          {busy ? (
            <Button type="button" variant="outline" size="sm" onClick={() => stop()}>
              Stop
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}
