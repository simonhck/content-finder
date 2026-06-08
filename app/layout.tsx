import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ConfigProvider } from "@/components/providers/config-provider"
import { MarketplaceProvider } from "@/components/providers/marketplace-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <MarketplaceProvider>
              <ConfigProvider>{children}</ConfigProvider>
            </MarketplaceProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
