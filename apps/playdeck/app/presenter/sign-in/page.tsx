import { SignInForm } from "@/features/presenter-auth/sign-in-form"

export const metadata = {
  title: "Sign In — PlayDeck",
  description: "Sign in to your presenter account.",
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
            Sign in to manage your decks.
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  )
}
