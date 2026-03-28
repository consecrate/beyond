"use client"

import { useRouter } from "next/navigation"

import { Button } from "@beyond/design-system"

export function SessionPageBackButton() {
  const router = useRouter()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Go back"
      onClick={() => router.back()}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-5"
        aria-hidden
      >
        <path
          d="M19 12H5M5 12L12 19M5 12L12 5"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  )
}
