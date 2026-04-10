import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import FullPageLoader from "@/components/app/FullPageLoader";
import AppErrorBoundary from "@/components/app/AppErrorBoundary";
import RequireAuth from "@/components/auth/RequireAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/providers/AuthProvider";
import { FinanceProvider } from "@/stores/financeStore";
const BillsPage = lazy(() => import("@/pages/BillsPage"));
const BricksPage = lazy(() => import("@/pages/BricksPage"));
const CashFlowPage = lazy(() => import("@/pages/CashFlowPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ImportsPage = lazy(() => import("@/pages/ImportsPage"));
const IncomePage = lazy(() => import("@/pages/IncomePage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const TargetsPage = lazy(() => import("@/pages/TargetsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoutes() {
  return (
    <RequireAuth>
      <FinanceProvider>
        <AppLayout>
          <Suspense fallback={<FullPageLoader message="Carregando painel..." />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/income" element={<IncomePage />} />
              <Route path="/bricks" element={<BricksPage />} />
              <Route path="/cashflow" element={<CashFlowPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/targets" element={<TargetsPage />} />
              <Route path="/imports" element={<ImportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </FinanceProvider>
    </RequireAuth>
  );
}

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<FullPageLoader message="Carregando aplicacao..." />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
