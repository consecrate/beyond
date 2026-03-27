import { SignUpForm } from "@/features/auth/sign-up-form"

export const metadata = {
  title: "Sign Up — Firstly",
  description: "Create a Firstly account.",
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Start structuring what you want to learn.
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}
