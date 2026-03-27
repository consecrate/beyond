"use client"

import Link from "next/link"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@beyond/design-system"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex max-w-lg flex-col items-center gap-3 text-center">
        <h1
          className={cn(
            "font-display text-[2.125rem] leading-none font-medium tracking-[-0.02em] text-foreground sm:text-4xl"
          )}
        >
          Firstly
        </h1>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          From your first step to your true potential. Now piloting at Elle.
        </p>
      </header>

      <div className="flex w-full max-w-2xl flex-col gap-px overflow-hidden rounded-sm border border-border bg-border sm:flex-row sm:gap-0">
        <Card className="w-full rounded-none border-0 sm:w-1/2">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-sans text-[0.9375rem] font-semibold">
              What Firstly is
            </CardTitle>
            <CardDescription className="text-[0.8125rem] leading-snug">
              A tool that turns rough goals, notes, and problem sets into a
              clear path to mastery with skill graphs, prerequisite breakdowns, session-based
              lessons, and practice so you always know the next step.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="hidden w-px shrink-0 bg-border sm:block" aria-hidden />

        <Card className="w-full rounded-none border-0 sm:w-1/2">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-sans text-[0.9375rem] font-semibold">
              Make the Leap
            </CardTitle>
            <CardDescription className="text-[0.8125rem] leading-snug">
              Create an account and start building structured progress toward what you want to
              learn.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button nativeButton={false} render={<Link href="/sign-up" />}>
              Sign up
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
