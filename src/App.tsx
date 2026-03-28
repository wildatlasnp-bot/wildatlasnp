import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProStatusProvider } from "@/contexts/ProStatusContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Detects auth error params in the URL hash (e.g. from an expired/consumed
 * email confirmation link) and shows a helpful toast instead of silently
 * dropping the user on /auth with no explanation.
 */
const AuthRedirectErrorHandler = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("error=")) return;

    const params = new URLSearchParams(hash.substring(1));
    const errorDesc = params.get("error_description") || params.get("error");

    if (errorDesc) {
      // Clean the URL immediately
      window.history.replaceState(null, "", window.location.pathname + window.location.search);

      // Show helpful message and redirect to auth
      toast({
        title: "Confirmation link expired",
        description: "Your email is confirmed — just sign in with your email and password.",
      });
      navigate("/auth", { replace: true });
    }
  }, [toast, navigate]);

  return null;
};

/** Global auth loading gate — shows a neutral spinner until session hydration completes. */
const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }
  return <>{children}</>;
};

// Redirects unauthenticated users to /auth. Auth is guaranteed ready by AuthGate.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

/** Redirects authenticated users away from public-only routes (landing, auth). */
const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user) {
    // Authenticated: send to onboarding (handled inside Index) or app
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
};
// Critical-path — always in the initial bundle
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import OnboardingFlow from "./components/OnboardingFlow"; // used in inline OnboardingPreview below

// Lazy-loaded — split into separate chunks, fetched only when the route is visited
const NotFound              = lazy(() => import("./pages/NotFound"));
const SettingsPage          = lazy(() => import("./pages/SettingsPage"));
const ResetPassword         = lazy(() => import("./pages/ResetPassword"));
const PrivacyPolicy         = lazy(() => import("./pages/PrivacyPolicy"));
const TermlyPrivacyPolicy   = lazy(() => import("./pages/TermlyPrivacyPolicy"));
const TermsOfService        = lazy(() => import("./pages/TermsOfService"));
const AdminHealthPage       = lazy(() => import("./pages/AdminHealthPage"));
const AdminPerformancePage  = lazy(() => import("./pages/AdminPerformancePage"));
const CheckEmailPage        = lazy(() => import("./pages/CheckEmailPage"));
const SubscriptionSuccessPage = lazy(() => import("./pages/SubscriptionSuccessPage"));
const AlertDetailPage       = lazy(() => import("./pages/AlertDetailPage"));
const MascotGallery         = lazy(() => import("./pages/MascotGallery"));

/** Standalone preview wrapper for OnboardingFlow — no auth required. */
const OnboardingPreview = () => (
  <div className="min-h-screen bg-background">
    <OnboardingFlow onComplete={() => alert("Onboarding complete!")} userId="preview-user" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 min before refetch
      gcTime: 1000 * 60 * 10,     // 10 min garbage collection
      retry: 2,                    // 2 retries on failure
      refetchOnWindowFocus: false, // prevent refetch storms
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProStatusProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthGate>
              <AuthRedirectErrorHandler />
              <Suspense fallback={
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100vh',
                  background: '#F0EDEA',
                }} />
              }>
                <Routes>
                  <Route path="/" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
                  <Route path="/auth" element={<PublicOnlyRoute><AuthPage /></PublicOnlyRoute>} />
                  <Route path="/check-email" element={<CheckEmailPage />} />
                  <Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/privacy-policy" element={<TermlyPrivacyPolicy />} />
                  <Route path="/settings" element={<ProtectedRoute><Navigate to="/app?tab=settings" replace /></ProtectedRoute>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/admin/health" element={<ProtectedRoute><AdminHealthPage /></ProtectedRoute>} />
                  <Route path="/admin/performance" element={<ProtectedRoute><AdminPerformancePage /></ProtectedRoute>} />
                  <Route path="/success" element={<SubscriptionSuccessPage />} />
                  <Route path="/alert" element={<AlertDetailPage />} />
                  <Route path="/mascots" element={<MascotGallery />} />
                  <Route path="/onboarding-preview" element={<OnboardingPreview />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthGate>
          </BrowserRouter>
        </TooltipProvider>
        </ProStatusProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
