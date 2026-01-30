import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsButton } from "./components/SettingsButton";
import GlobalUploadProgress from "./components/GlobalUploadProgress";
import AppLayout from "./components/AppLayout";
import { AppContextProvider } from "./contexts/AppContext";
import { Loader2 } from "lucide-react";

// Lazy load pages for better initial load
const Index = lazy(() => import("./pages/Index"));
const SugyaDetail = lazy(() => import("./pages/SugyaDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <span className="text-muted-foreground">טוען את האפליקציה...</span>
    </div>
  </div>
);

// Configure QueryClient with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContextProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/*"
                  element={
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/sugya/:id" element={<SugyaDetail />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  }
                />
              </Routes>
            </Suspense>
          </AppContextProvider>
        </BrowserRouter>
        <SettingsButton />
        <GlobalUploadProgress />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
