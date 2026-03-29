import type { Metadata } from "next"
import { Google_Sans_Flex, Newsreader } from "next/font/google"

import "./globals.css"

const fontSans = Google_Sans_Flex({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
})

const fontSerif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://joshing.us"),
  title: "Joshing",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontSerif.variable}`}>{children}</body>
    </html>
  )
}
