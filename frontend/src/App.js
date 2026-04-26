import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardPage from "@/pages/DashboardPage";
import LeadsPage from "@/pages/LeadsPage";
import CustomersPage from "@/pages/CustomersPage";
import ReceiptsPage from "@/pages/ReceiptsPage";
import ReceiptPrintPage from "@/pages/ReceiptPrintPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import VendorsPage from "@/pages/VendorsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import VerifyReceiptPage from "@/pages/VerifyReceiptPage";
import TeamPage from "@/pages/TeamPage";

const ProtectedRoute = () => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="label-uppercase animate-pulse" data-testid="auth-loading">Loading…</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const PublicOnly = () => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
};

const AdminOnly = ({ children }) => {
  const { profile, isAdmin, loading } = useAuth();
  if (loading) return null;
  // Profile may load slightly after session — wait for it before deciding role.
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="label-uppercase animate-pulse">Loading…</div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/verify/:uid" element={<VerifyReceiptPage />} />

            <Route element={<PublicOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/receipts/:id/print" element={<ReceiptPrintPage />} />
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/receipts" element={<ReceiptsPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/vendors" element={<VendorsPage />} />
                <Route path="/team" element={<AdminOnly><TeamPage /></AdminOnly>} />
                <Route path="/approvals" element={<AdminOnly><ApprovalsPage /></AdminOnly>} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" duration={2200} />
      </AuthProvider>
    </div>
  );
}

export default App;
