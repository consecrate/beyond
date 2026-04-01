import "./globals.css"
import { fontDisplay, fontMono, fontSans } from "@beyond/design-system/fonts/next"
import { ThemeProvider } from "@beyond/design-system"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable} antialiased`}
    >
      <body className={fontSans.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
