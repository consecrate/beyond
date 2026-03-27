"use client"

import Link from "next/link"
import {
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@beyond/design-system"

export default function HostPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Host a session</CardTitle>
          <CardDescription>
            Select a deck and start presenting. Students will join using the
            session code displayed on screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Deck selection and session controls will appear here.
          </p>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← Back
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
