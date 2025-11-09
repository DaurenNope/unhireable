import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
// Components
import { ErrorBoundary } from "./components/error-boundary";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/toaster";
import { ThemeToggle } from "./components/theme-toggle";
import { MainNav } from "./components/main-nav";
import { MobileNav } from "./components/mobile-nav";
import { UserNav } from "./components/user-nav";
// Pages
import { Dashboard } from "./pages/dashboard";
import { Jobs } from "./pages/jobs";
import Applications from "./pages/applications";
import { Settings } from "./pages/settings";
import { JobDetails } from "./pages/job-details";
import { ApplicationDetails } from "./pages/application-details";
import { NotFound } from "./pages/not-found";
import ChecklistPage from "./pages/checklist";
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
    return (_jsx(ErrorBoundary, { children: _jsxs(QueryClientProvider, { client: queryClient, children: [_jsx(ThemeProvider, { defaultTheme: "system", storageKey: "jobhunter-theme", children: _jsx(Router, { children: _jsxs("div", { className: "relative flex min-h-screen flex-col", children: [_jsx("header", { className: "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", children: _jsxs("div", { className: "container flex h-16 items-center", children: [_jsx("div", { className: "mr-4 hidden md:flex", children: _jsx(MainNav, {}) }), _jsxs("div", { className: "flex flex-1 items-center justify-between space-x-2 md:justify-end", children: [_jsx("div", { className: "w-full flex-1 md:w-auto md:flex-none" }), _jsxs("nav", { className: "flex items-center space-x-2", children: [_jsx(ThemeToggle, {}), _jsx(UserNav, {}), _jsx(MobileNav, {})] })] })] }) }), _jsx("main", { className: "flex-1", children: _jsx("div", { className: "container py-6", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/jobs", element: _jsx(Jobs, {}) }), _jsx(Route, { path: "/jobs/:id", element: _jsx(JobDetails, {}) }), _jsx(Route, { path: "/applications", element: _jsx(Applications, {}) }), _jsx(Route, { path: "/applications/:id", element: _jsx(ApplicationDetails, {}) }), _jsx(Route, { path: "/checklist", element: _jsx(ChecklistPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "/404", element: _jsx(NotFound, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/404", replace: true }) })] }) }) }), _jsx(Toaster, {})] }) }) }), _jsx(ReactQueryDevtools, { initialIsOpen: false })] }) }));
}
export default App;
