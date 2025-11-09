import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

// Components
import { ErrorBoundary } from "./components/error-boundary"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/toaster"
import { ThemeToggle } from "./components/theme-toggle"
import { MainNav } from "./components/main-nav"
import { MobileNav } from "./components/mobile-nav"
import { UserNav } from "./components/user-nav"

// Pages
import { Dashboard } from "./pages/dashboard"
import { Jobs } from "./pages/jobs"
import Applications from "./pages/applications"
import { Settings } from "./pages/settings"
import { JobDetails } from "./pages/job-details"
import { ApplicationDetails } from "./pages/application-details"
import { NotFound } from "./pages/not-found"
import ChecklistPage from "./pages/checklist"

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
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="jobhunter-theme">
          <Router>
          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-16 items-center">
                <div className="mr-4 hidden md:flex">
                  <MainNav />
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                  <div className="w-full flex-1 md:w-auto md:flex-none">
                    {/* Search bar can go here */}
                  </div>
                  <nav className="flex items-center space-x-2">
                    <ThemeToggle />
                    <UserNav />
                    <MobileNav />
                  </nav>
                </div>
              </div>
            </header>
            <main className="flex-1">
              <div className="container py-6">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/jobs/:id" element={<JobDetails />} />
                  <Route path="/applications" element={<Applications />} />
                  <Route path="/applications/:id" element={<ApplicationDetails />} />
                  <Route path="/checklist" element={<ChecklistPage />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </div>
            </main>
            <Toaster />
          </div>
          </Router>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
