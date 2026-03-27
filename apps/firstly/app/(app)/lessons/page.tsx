import { redirect } from "next/navigation"

export default function LegacyLessonsIndexRedirect() {
  redirect("/sessions")
}
