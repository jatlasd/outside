import { cn } from "@/lib/utils"
import { Fraunces, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google"
import "./globals.css"

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
})

const ui = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-ui",
})

const data = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-data",
})

export const metadata = {
  title: "Field log — how outside hits you today",
  description:
    "A daily read of how strongly weather, air, and allergens stack up against you, using only the factors you enable. Open-Meteo data for your chosen location.",
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={cn(display.variable, ui.variable, data.variable, "h-full antialiased")}
    >
      <body className="flex min-h-full flex-col">
        <div className="relative z-60 flex-1">{children}</div>
      </body>
    </html>
  )
}
