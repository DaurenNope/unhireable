import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Loader2 } from 'lucide-react';
// Components
import { ErrorBoundary } from "./components/error-boundary";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/toaster";
import { ThemeToggle } from "./components/theme-toggle";
import { MainNav } from "./components/main-nav";
import { MobileNav } from "./components/mobile-nav";
import { UserNav } from "./components/user-nav";
import { SkipNavLink } from "./components/a11y/skip-nav";
import { OfflineBanner } from "./components/offline-banner";
// Simple wrapper to catch ThemeProvider errors
function ThemeProviderWrapper({ children }) {
    try {
        return (_jsx(ThemeProvider, { defaultTheme: "system", storageKey: "unhireable-theme", children: children }));
    }
    catch (error) {
        console.error('ThemeProvider error, rendering without theme:', error);
        return _jsx(_Fragment, { children: children });
    }
}
// Pages
import { Dashboard } from "./pages/dashboard";
import { Jobs } from "./pages/jobs";
import { Pulse } from "./pages/pulse";
import Applications from "./pages/applications";
import { Settings } from "./pages/settings";
import { JobDetails } from "./pages/job-details";
import { ApplicationDetails } from "./pages/application-details";
import { NotFound } from "./pages/not-found";
import { AuthLogin, AuthSetup } from "./pages/auth";
import { PersonaTest } from "./pages/persona-test";
import { ResumeAnalyzer } from "./pages/resume-analyzer";
import AutoPilot from "./pages/autopilot";
import Testing from "./pages/testing";
import { authApi } from "./api/client";
// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
        },
    },
});
function App() {
    return (_jsx(ErrorBoundary, { children: _jsxs(QueryClientProvider, { client: queryClient, children: [_jsx(ThemeProviderWrapper, { children: _jsx(AuthGuard, {}) }), _jsx(ReactQueryDevtools, { initialIsOpen: false }), _jsx(Toaster, {})] }) }));
}
function AuthGuard() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['auth-status'],
        queryFn: authApi.getStatus,
        refetchOnWindowFocus: false,
        retry: 2,
        retryDelay: 1000,
        staleTime: 30000, // 30 seconds
    });
    // If loading for more than 5 seconds or error, show error state
    if (error) {
        console.error('Auth status check failed:', error);
        // If auth check fails, assume not configured for now
        return _jsx(AuthSetup, { onSuccess: () => refetch() });
    }
    if (isLoading || !data) {
        return _jsx(FullScreenLoader, { message: "Checking authentication..." });
    }
    if (!data.configured) {
        return _jsx(AuthSetup, { onSuccess: () => refetch() });
    }
    if (!data.authenticated) {
        return _jsx(AuthLogin, { onSuccess: () => refetch() });
    }
    return _jsx(AuthenticatedApp, {});
}
function AuthenticatedApp() {
    const queryClient = useQueryClient();
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    useEffect(() => {
        const setupNotificationListener = async () => {
            if (typeof window === 'undefined' || !window.__TAURI__) {
                return;
            }
            try {
                const { listen } = await import('@tauri-apps/api/event');
                const { invoke } = await import('@tauri-apps/api/core');
                const unlisten = await listen('new-jobs-found', async (event) => {
                    const payload = event.payload;
                    try {
                        await invoke('send_desktop_notification', {
                            title: payload.title,
                            body: payload.body,
                        });
                    }
                    catch (error) {
                        console.error('Failed to send notification:', error);
                    }
                    queryClient.invalidateQueries({ queryKey: ['jobs'] });
                    queryClient.invalidateQueries({ queryKey: ['saved-searches-status'] });
                });
                return () => {
                    unlisten();
                };
            }
            catch (error) {
                console.error('Failed to set up notification listener:', error);
            }
        };
        setupNotificationListener();
    }, [queryClient]);
    return (_jsxs(Router, { children: [_jsx(SkipNavLink, {}), _jsxs("div", { className: "relative flex min-h-screen bg-background", children: [_jsx("aside", { className: "hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:border-r md:border-border/40 bg-background/95 backdrop-blur-sm", "aria-label": "Primary navigation", children: _jsxs("div", { className: "flex flex-col flex-grow pt-5 pb-4 overflow-y-auto", children: [_jsx("div", { className: "flex items-center flex-shrink-0 px-4 mb-6", children: _jsxs("h1", { className: "text-xl font-black tracking-tighter", children: [_jsx("span", { className: "bg-cyan-400 text-black px-2", children: "UN" }), _jsx("span", { className: "text-foreground", children: "HIREABLE" })] }) }), _jsx("div", { className: "flex-grow px-3", children: _jsx(MainNav, {}) })] }) }), _jsxs("div", { className: "flex flex-col flex-1 md:pl-64", children: [_jsx("header", { className: "sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 shadow-sm", children: _jsxs("div", { className: "flex h-16 items-center px-4 sm:px-6 lg:px-8", children: [_jsx("div", { className: "flex md:hidden mr-4", children: _jsx(MobileNav, {}) }), _jsxs("div", { className: "flex flex-1 items-center justify-between space-x-2 md:justify-end", children: [_jsx("div", { className: "w-full flex-1 md:w-auto md:flex-none" }), _jsxs("nav", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "hidden md:inline-flex items-center rounded-full border border-border/50 px-2.5 py-1 text-xs font-medium text-muted-foreground", children: "Desktop Mode" }), _jsx(ThemeToggle, {}), _jsx(UserNav, {})] })] })] }) }), !isOnline && (_jsx("div", { className: "px-4 sm:px-6 lg:px-8 pt-4", children: _jsx(OfflineBanner, {}) })), _jsx("main", { id: "main-content", tabIndex: -1, className: "flex-1 focus:outline-none", children: _jsx("div", { className: "px-4 sm:px-6 lg:px-8", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/jobs", element: _jsx(Jobs, {}) }), _jsx(Route, { path: "/pulse", element: _jsx(Pulse, {}) }), _jsx(Route, { path: "/jobs/:id", element: _jsx(JobDetails, {}) }), _jsx(Route, { path: "/applications", element: _jsx(Applications, {}) }), _jsx(Route, { path: "/applications/:id", element: _jsx(ApplicationDetails, {}) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "/persona-test", element: _jsx(PersonaTest, {}) }), _jsx(Route, { path: "/resume-analyzer", element: _jsx(ResumeAnalyzer, {}) }), _jsx(Route, { path: "/autopilot", element: _jsx(AutoPilot, {}) }), _jsx(Route, { path: "/testing", element: _jsx(Testing, {}) }), _jsx(Route, { path: "/404", element: _jsx(NotFound, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/404", replace: true }) })] }) }) })] })] })] }));
}
function FullScreenLoader({ message }) {
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background text-muted-foreground", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx(Loader2, { className: "h-6 w-6 animate-spin" }), _jsx("p", { children: message })] }) }));
}
export default App;
