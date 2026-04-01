import { Google_Sans_Code, Google_Sans_Flex, Newsreader } from "next/font/google"

/** Default sans: Google Sans Flex (variable). */
export const fontSans = Google_Sans_Flex({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-sans-flex",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
})

/** Default monospace: Google Sans Code (variable). */
export const fontMono = Google_Sans_Code({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-sans-code",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
})

/** Display serif for wordmarks and primary page titles. */
export const fontDisplay = Newsreader({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-newsreader",
  display: "swap",
})
