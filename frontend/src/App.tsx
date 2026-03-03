import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// @ts-ignore - future flags suppress React Router v6→v7 console warnings
const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Loader2 } from 'lucide-react';

// Components
import { ErrorBoundary } from "./components/error-boundary"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/toaster"
import { ThemeToggle } from "./components/theme-toggle"
import { MainNav } from "./components/main-nav"
import { MobileNav } from "./components/mobile-nav"
import { UserNav } from "./components/user-nav"
import { SkipNavLink } from "./components/a11y/skip-nav"
import { OfflineBanner } from "./components/offline-banner"

// Simple wrapper to catch ThemeProvider errors
function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  try {
    return (
      <ThemeProvider defaultTheme="system" storageKey="unhireable-theme">
        {children}
      </ThemeProvider>
    );
  } catch (error) {
    console.error('ThemeProvider error, rendering without theme:', error);
    return <>{children}</>;
  }
}

// Pages
import { Dashboard } from "./pages/dashboard"
import { Jobs } from "./pages/jobs"
import Applications from "./pages/applications"
import { Settings } from "./pages/settings"
import { JobDetails } from "./pages/job-details"
import { ApplicationDetails } from "./pages/application-details"
import { NotFound } from "./pages/not-found"
import { AuthLogin, AuthSetup } from "./pages/auth"
import AutoPilot from "./pages/autopilot"
import { authApi } from "./api/client"

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
        <ThemeProviderWrapper>
          <AuthGuard />
        </ThemeProviderWrapper>
        <ReactQueryDevtools initialIsOpen={false} />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

function AuthGuard() {
  // Check if we're running in web preview mode (no Tauri bridge)
  const isWebPreview = !window.__TAURI__;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['auth-status'],
    queryFn: authApi.getStatus,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000, // 30 seconds
    enabled: !isWebPreview, // Skip auth check in web preview mode
  });

  // Web preview mode: bypass auth entirely for testing
  if (isWebPreview) {
    console.log('🌐 Web preview mode: bypassing authentication for testing');
    return <AuthenticatedApp />;
  }

  // If loading for more than 5 seconds or error, show error state
  if (error) {
    console.error('Auth status check failed:', error);
    // If auth check fails, assume not configured for now
    return <AuthSetup onSuccess={() => refetch()} />;
  }

  if (isLoading || !data) {
    return <FullScreenLoader message="Checking authentication..." />;
  }

  if (!data.configured) {
    return <AuthSetup onSuccess={() => refetch()} />;
  }

  if (!data.authenticated) {
    return <AuthLogin onSuccess={() => refetch()} />;
  }

  return <AuthenticatedApp />;
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
    const setupNotificationListener = async (): Promise<void | (() => void)> => {
      if (typeof window === 'undefined' || !window.__TAURI__) {
        return;
      }

      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { invoke } = await import('@tauri-apps/api/core');

        const unlisten = await listen('new-jobs-found', async (event) => {
          const payload = event.payload as { search_name: string; job_count: number; title: string; body: string };

          try {
            await invoke('send_desktop_notification', {
              title: payload.title,
              body: payload.body,
            });
          } catch (error) {
            console.error('Failed to send notification:', error);
          }

          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.invalidateQueries({ queryKey: ['saved-searches-status'] });
        });

        return () => {
          unlisten();
        };
      } catch (error) {
        console.error('Failed to set up notification listener:', error);
        return;
      }
    };

    setupNotificationListener();
  }, [queryClient]);

  return (
    <Router future={ROUTER_FUTURE}>
      <SkipNavLink />
      <div className="relative flex min-h-screen bg-background">
        {/* Sidebar Navigation */}
        <aside
          className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:border-r md:border-border/40 bg-background/95 backdrop-blur-sm"
          aria-label="Primary navigation"
        >
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <h1 className="text-xl font-black tracking-tighter">
                <span className="bg-cyan-400 text-black px-2">UN</span>
                <span className="text-foreground">HIREABLE</span>
              </h1>
            </div>
            <div className="flex-grow px-3">
              <MainNav />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 md:pl-64">
          {/* Top Header */}
          <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 shadow-sm">
            <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
              <div className="flex md:hidden mr-4">
                <MobileNav />
              </div>
              <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                <div className="w-full flex-1 md:w-auto md:flex-none">
                  {/* Search or breadcrumbs can go here */}
                </div>
                <nav className="flex items-center space-x-2">
                  <span className="hidden md:inline-flex items-center rounded-full border border-border/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Desktop Mode
                  </span>
                  <ThemeToggle />
                  <UserNav />
                </nav>
              </div>
            </div>
          </header>

          {/* Offline Banner */}
          {!isOnline && (
            <div className="px-4 sm:px-6 lg:px-8 pt-4">
              <OfflineBanner />
            </div>
          )}

          {/* Page Content */}
          <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
            <div className="px-4 sm:px-6 lg:px-8">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/:id" element={<JobDetails />} />
                <Route path="/applications" element={<Applications />} />
                <Route path="/applications/:id" element={<ApplicationDetails />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/autopilot" element={<AutoPilot />} />
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

function FullScreenLoader({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>{message}</p>
      </div>
    </div>
  );
}

export default App
