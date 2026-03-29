import { PlaydeckJazzProvider } from "@/features/jazz"

export default function PresenterLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <PlaydeckJazzProvider>{children}</PlaydeckJazzProvider>
}
