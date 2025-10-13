import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { AuthProvider } from './contexts/auth-context';
import { AuthModalProvider } from './components/auth/AuthModalProvider';
import { ThemeProvider } from './contexts/theme-context';
import { Toaster } from './components/ui/sonner';
import { AppLayout } from './components/layout/app-layout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Loading fallback for lazy-loaded routes
function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AuthModalProvider>
            <AppLayout>
              <Suspense fallback={<LoadingFallback />}>
                <Outlet />
              </Suspense>
            </AppLayout>
            <Toaster richColors position="top-right" />
          </AuthModalProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}