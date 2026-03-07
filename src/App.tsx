import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProStatusProvider } from "@/contexts/ProStatusContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import SettingsPage from "./pages/SettingsPage";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermlyPrivacyPolicy from "./pages/TermlyPrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import AdminHealthPage from "./pages/AdminHealthPage";
import CheckEmailPage from "./pages/CheckEmailPage";
import SubscriptionSuccessPage from "./pages/SubscriptionSuccessPage";
import AlertDetailPage from "./pages/AlertDetailPage";
import DevGate from "./components/DevGate";

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
          <DevGate>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/check-email" element={<CheckEmailPage />} />
                <Route path="/app" element={<Index />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/privacy-policy" element={<TermlyPrivacyPolicy />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/admin/health" element={<AdminHealthPage />} />
                <Route path="/success" element={<SubscriptionSuccessPage />} />
                <Route path="/alert" element={<AlertDetailPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </DevGate>
        </TooltipProvider>
        </ProStatusProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
