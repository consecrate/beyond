"use client"

import Link from "next/link"
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@beyond/design-system"

export default function JoinPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join a session</CardTitle>
          <CardDescription>
            Enter the session code shared by your instructor to join the live
            session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input placeholder="Session code" />
          <div className="flex gap-2">
            <Button size="lg" className="flex-1">
              Join
            </Button>
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              ← Back
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
