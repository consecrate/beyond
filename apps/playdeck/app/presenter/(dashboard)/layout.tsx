export default function PresenterDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="presenter-dashboard flex min-h-svh flex-col bg-background">
      <main className="min-h-0 min-w-0 flex-1">{children}</main>
    </div>
  )
}
