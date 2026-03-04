import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import SettingsPage from "./pages/SettingsPage";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import AdminHealthPage from "./pages/AdminHealthPage";
import CheckEmailPage from "./pages/CheckEmailPage";
import DevGate from "./components/DevGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/admin/health" element={<AdminHealthPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DevGate>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
