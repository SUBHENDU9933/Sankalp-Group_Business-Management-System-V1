import "@/App.css";
import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { unlockAudioOnFirstInteraction } from "@/utils/chime";
import PermissionRoute from "@/components/auth/PermissionRoute";
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
import EstimatesPage from "@/pages/EstimatesPage";
import ProfileSettingsPage from "@/pages/ProfileSettingsPage";
import VendorDetailPage from "@/pages/VendorDetailPage";
import TrashPage from "@/pages/TrashPage";
import AuditLogPage from "@/pages/AuditLogPage";
import DigitalApprovalsPage from "@/pages/DigitalApprovalsPage";
import PublicApprovePage from "@/pages/PublicApprovePage";
import AgreementsPage from "@/pages/AgreementsPage";
import AgreementEditorPage from "@/pages/AgreementEditorPage";
import AgreementPrintPage from "@/pages/AgreementPrintPage";
import AgreementTemplatesPage from "@/pages/AgreementTemplatesPage";
import PublicSignAgreementPage from "@/pages/PublicSignAgreementPage";
import AdminNotifyPage from "@/pages/AdminNotifyPage";
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));

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

// The manual/scheduled broadcast tool is restricted to one specific account,
// enforced server-side too (see admin_send_notification RPC).
const SuperAdminOnly = ({ children }) => {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="label-uppercase animate-pulse">Loading…</div>
      </div>
    );
  }
  if (profile.email !== "info.subhendu@gmail.com") return <Navigate to="/" replace />;
  return children;
};

function App() {
  useEffect(() => { unlockAudioOnFirstInteraction(); }, []);
  return (
    <div className="App">
      <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/verify/:uid" element={<VerifyReceiptPage />} />
            <Route path="/approve/:token" element={<PublicApprovePage />} />
            <Route path="/approve-app/:token" element={<PublicApprovePage />} />
            <Route path="/sign/:token" element={<PublicSignAgreementPage />} />

            <Route element={<PublicOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<PermissionRoute resource="receipts" />}>
                <Route path="/receipts/:id/print" element={<ReceiptPrintPage />} />
              </Route>
              <Route element={<PermissionRoute resource="agreements" />}>
                <Route path="/agreements/:id/print" element={<AgreementPrintPage />} />
              </Route>

              <Route element={<DashboardLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfileSettingsPage />} />

                <Route element={<PermissionRoute resource="leads" />}>
                  <Route path="/leads" element={<LeadsPage />} />
                </Route>
                <Route element={<PermissionRoute resource="customers" />}>
                  <Route path="/customers" element={<CustomersPage />} />
                </Route>
                <Route element={<PermissionRoute resource="estimates" />}>
                  <Route path="/estimates" element={<EstimatesPage />} />
                </Route>
                <Route element={<PermissionRoute resource="receipts" />}>
                  <Route path="/receipts" element={<ReceiptsPage />} />
                </Route>
                <Route element={<PermissionRoute resource="projects" />}>
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                </Route>
                <Route element={<PermissionRoute resource="vendors" />}>
                  <Route path="/vendors" element={<VendorsPage />} />
                  <Route path="/vendors/:id" element={<VendorDetailPage />} />
                </Route>
                <Route element={<PermissionRoute resource="digital_approvals" />}>
                  <Route path="/digital-approvals" element={<DigitalApprovalsPage />} />
                </Route>
                <Route element={<PermissionRoute resource="agreements" />}>
                  <Route path="/agreements" element={<AgreementsPage />} />
                  <Route path="/agreements/:id/edit" element={<PermissionRoute resource="agreements" action="edit"><AgreementEditorPage /></PermissionRoute>} />
                </Route>
                <Route path="/agreements/new" element={<PermissionRoute resource="agreements" action="create"><AgreementEditorPage /></PermissionRoute>} />

                <Route path="/team" element={<AdminOnly><TeamPage /></AdminOnly>} />
                <Route path="/approvals" element={<AdminOnly><ApprovalsPage /></AdminOnly>} />
                <Route path="/agreement-templates" element={<AdminOnly><AgreementTemplatesPage /></AdminOnly>} />
                <Route path="/audit-log" element={<AdminOnly><AuditLogPage /></AdminOnly>} />
                <Route path="/admin-notify" element={<SuperAdminOnly><AdminNotifyPage /></SuperAdminOnly>} />

                <Route path="/reports" element={
                  <PermissionRoute resource="reports">
                    <Suspense fallback={<div className="p-16 text-center text-slate-400">Loading Reports…</div>}>
                      <ReportsPage />
                    </Suspense>
                  </PermissionRoute>
                } />
                <Route path="/trash" element={<TrashPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" duration={2200} />
      </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
