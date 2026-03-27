"use client"

import Link from "next/link"
import {
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@beyond/design-system"
import { fontDisplay } from "@/lib/fonts/display"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex max-w-lg flex-col items-center gap-3 text-center">
        <h1
          className={cn(
            fontDisplay.className,
            "text-[2.125rem] leading-none font-medium tracking-[-0.02em] text-foreground sm:text-4xl"
          )}
        >
          PlayDeck
        </h1>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">
          Better Engagement. Better Learning. Now piloting at Elle.
        </p>
      </header>

      <div className="flex w-full max-w-xl flex-col gap-px overflow-hidden rounded-sm border border-border bg-border sm:flex-row sm:gap-0">
        <Card className="w-full rounded-none border-0 sm:w-1/2">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-sans text-[0.9375rem] font-semibold">
              Host a session
            </CardTitle>
            <CardDescription className="text-[0.8125rem] leading-snug">
              Present and engage in real time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/presenter/sign-up"
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              Get started
            </Link>
          </CardContent>
        </Card>

        <div className="hidden w-px shrink-0 bg-border sm:block" aria-hidden />

        <Card className="w-full rounded-none border-0 sm:w-1/2">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-sans text-[0.9375rem] font-semibold">
              Join a session
            </CardTitle>
            <CardDescription className="text-[0.8125rem] leading-snug">
              Enter the code and jump in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/join"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full border-border bg-background"
              )}
            >
              Join now
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
