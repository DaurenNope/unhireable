"use client"

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="jobhunter-theme"
      themes={["light", "dark", "system"]}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
