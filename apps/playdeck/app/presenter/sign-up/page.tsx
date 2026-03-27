import { SignUpForm } from "@/features/presenter-auth/sign-up-form"

export const metadata = {
  title: "Sign Up — PlayDeck",
  description: "Create a presenter account to build and host interactive decks.",
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
            Start building interactive decks for your classroom.
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}
