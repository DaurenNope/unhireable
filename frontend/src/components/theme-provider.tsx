import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  try {
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
  } catch (error) {
    console.error('ThemeProvider error:', error);
    // Fallback: render children without theme provider
    return <>{children}</>;
  }
}
