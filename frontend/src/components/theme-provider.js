import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children, ...props }) {
    try {
        return (_jsx(NextThemesProvider, { attribute: "class", defaultTheme: "system", enableSystem: true, disableTransitionOnChange: true, storageKey: "jobhunter-theme", themes: ["light", "dark", "system"], ...props, children: children }));
    }
    catch (error) {
        console.error('ThemeProvider error:', error);
        // Fallback: render children without theme provider
        return _jsx(_Fragment, { children: children });
    }
}
