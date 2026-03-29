export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-svh bg-background">
      <main className="min-h-svh overflow-auto px-5 pb-0 md:px-8">
        {children}
      </main>
    </div>
  )
}
