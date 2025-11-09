"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children, ...props }) {
    return (_jsx(NextThemesProvider, { attribute: "class", defaultTheme: "system", enableSystem: true, disableTransitionOnChange: true, storageKey: "jobhunter-theme", themes: ["light", "dark", "system"], ...props, children: children }));
}
