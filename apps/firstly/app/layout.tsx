import "./globals.css"
import { fontDisplay, fontMono, fontSans } from "@beyond/design-system/fonts/next"
import { ThemeProvider } from "@beyond/design-system"

import { FirstlyJazzProvider } from "@/features/jazz"

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
      <body>
        <ThemeProvider>
          <FirstlyJazzProvider>{children}</FirstlyJazzProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
