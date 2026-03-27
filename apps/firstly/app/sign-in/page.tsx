import { SignInForm } from "@/features/auth/sign-in-form"

export const metadata = {
  title: "Sign In — Firstly",
  description: "Sign in to Firstly.",
}

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to open your sessions and lessons.
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  )
}
