import { Component, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, isJenan, isClientLead, isWalaaOps, isHrOps, hasOpsAccess, canViewBilling, canAccessPurchases, canEditStaffRequests, canEditIntake, canManageLeaves, canHrReviewLeaves, hasFullClientAccess, showSystemAdmin, canImportData, canViewReports, showMyReportsNav, showAcademicPortfolioNav, canViewSupervisionCaseload, canAccessManagerHub } from "./auth";
import Login from "./pages/Login";
import Shell from "./pages/Shell";
import AuthenticatedFileViewer from "./components/AuthenticatedFileViewer";
import "./App.css";

const CHUNK_RELOAD_KEY = "bg_chunk_reload";

function isChunkLoadError(err) {
  const msg = err?.message || String(err || "");
  return /Loading chunk [\d]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg);
}

/** Lazy-load a page; on stale deploy chunk miss, reload once to fetch the new assets. */
function lazyPage(factory) {
  return lazy(() =>
    factory()
      .then((mod) => {
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* ignore */ }
        return mod;
      })
      .catch((err) => {
        if (isChunkLoadError(err)) {
          try {
            if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
              sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
              window.location.reload();
              return new Promise(() => {});
            }
            sessionStorage.removeItem(CHUNK_RELOAD_KEY);
          } catch { /* ignore */ }
        }
        throw err;
      })
  );
}

const Home = lazyPage(() => import("./pages/Home"));
const Schedule = lazyPage(() => import("./pages/Schedule"));
const Clients = lazyPage(() => import("./pages/Clients"));
const Requests = lazyPage(() => import("./pages/Requests"));
const TherapistRequests = lazyPage(() => import("./pages/TherapistRequests"));
const Directory = lazyPage(() => import("./pages/Directory"));
const Intake = lazyPage(() => import("./pages/Intake"));
import IntakeWaiting from "./pages/IntakeWaiting";
import SchoolWaiting from "./pages/SchoolWaiting";
const Waiting = lazyPage(() => import("./pages/Waiting"));
const Resources = lazyPage(() => import("./pages/Resources"));
const Admin = lazyPage(() => import("./pages/Admin"));
const Reports = lazyPage(() => import("./pages/Reports"));
const EmailStatus = lazyPage(() => import("./pages/EmailStatus"));
const ImportPage = lazyPage(() => import("./pages/Import"));
const LeaveBalance = lazyPage(() => import("./pages/LeaveBalance"));
const LeaveRequests = lazyPage(() => import("./pages/LeaveRequests"));
const StaffLeave = lazyPage(() => import("./pages/StaffLeave"));
const Billing = lazyPage(() => import("./pages/Billing"));
const TherapistMyReports = lazyPage(() => import("./pages/TherapistMyReports"));
import ManagerHub from "./pages/ManagerHub";
const PerformanceMeetings = lazyPage(() => import("./pages/PerformanceMeetings"));
const Purchases = lazyPage(() => import("./pages/Purchases"));
const SupervisionCaseload = lazyPage(() => import("./pages/SupervisionCaseload"));
const DesignPreview = lazyPage(() => import("./pages/DesignPreview"));
const CenterTest = lazyPage(() => import("./pages/CenterTest"));
const MyLearning = lazyPage(() => import("./pages/MyLearning"));
import AdminCenterTests from "./pages/AdminCenterTests";

function Loading() {
  return <div className="min-h-screen flex items-center justify-center bg-organic"><div className="spinner"/></div>;
}

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function SystemAdminOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!showSystemAdmin(user)) return <Navigate to="/home" replace />;
  return children;
}

function AdminOnly({ children }) {
  return <SystemAdminOnly>{children}</SystemAdminOnly>;
}


function BillingAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canViewBilling(user)) return <Navigate to="/home" replace />;
  return children;
}

function OpsOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasOpsAccess(user)) return <Navigate to="/home" replace />;
  return children;
}

function LeaveManagerOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canManageLeaves(user)) return <Navigate to="/home" replace />;
  return children;
}

function ClientLeadOrAdmin({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canEditStaffRequests(user)) return <Navigate to="/home" replace />;
  return children;
}

function IntakeAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canEditIntake(user)) return <Navigate to="/home" replace />;
  return children;
}

function StaffLeaveAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canEditStaffRequests(user) && !canManageLeaves(user) && !canHrReviewLeaves(user)) return <Navigate to="/home" replace />;
  return children;
}

function PurchasesAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessPurchases(user)) return <Navigate to="/home" replace />;
  return children;
}

function ReportsAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canViewReports(user)) return <Navigate to="/home" replace />;
  return children;
}

function canOpenCenterTests(user) {
  if (!user) return false;
  if (user.can_view_reports) return true;
  return canViewReports(user) || isWalaaOps(user) || isClientLead(user) || isJenan(user) || isHrOps(user);
}

function CenterTestsAdminAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canOpenCenterTests(user)) return <Navigate to="/home" replace />;
  return children;
}

function ManagerHubAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessManagerHub(user)) return <Navigate to="/home" replace />;
  return children;
}

function MyReportsAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!showMyReportsNav(user)) return <Navigate to="/home" replace />;
  return children;
}

function MyLearningAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!showAcademicPortfolioNav(user)) return <Navigate to="/home" replace />;
  return children;
}

function SupervisionAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canViewSupervisionCaseload(user)) return <Navigate to="/home" replace />;
  return children;
}

function ImportAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canImportData(user)) return <Navigate to="/home" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/home" replace/> : <Login/>}/>
      <Route path="/design-preview" element={
        <Suspense fallback={<Loading/>}>
          <DesignPreview/>
        </Suspense>
      }/>
      <Route path="/center-test" element={
        <Suspense fallback={<Loading/>}>
          <CenterTest/>
        </Suspense>
      }/>
      <Route element={<Protected><Shell/></Protected>}>
        <Route path="/" element={<Navigate to="/home" replace/>}/>
        <Route path="/home" element={<Home/>}/>
        <Route path="/schedule" element={<Schedule/>}/>
        <Route path="/attendance" element={<Navigate to="/clients" replace/>}/>
        <Route path="/billing" element={<BillingAccess><Billing/></BillingAccess>}/>
        <Route path="/clients" element={<Clients/>}/>
        <Route path="/supervision" element={<SupervisionAccess><SupervisionCaseload/></SupervisionAccess>}/>
        <Route path="/intake" element={<IntakeAccess><Intake/></IntakeAccess>}/>
        <Route path="/waiting" element={<IntakeAccess><Waiting/></IntakeAccess>}/>
        <Route path="/waiting/intake" element={<Navigate to="/waiting?view=intake" replace/>}/>
        <Route path="/waiting/school" element={<Navigate to="/waiting?view=school" replace/>}/>
        <Route path="/my-requests" element={<TherapistRequests/>}/>
        <Route path="/my-reports" element={<MyReportsAccess><TherapistMyReports/></MyReportsAccess>}/>
        <Route path="/my-performance" element={<Protected><PerformanceMeetings/></Protected>}/>
        <Route path="/my-learning" element={<MyLearningAccess><MyLearning/></MyLearningAccess>}/>
        <Route path="/my-leaves" element={<Navigate to="/my-requests" replace/>}/>
        <Route path="/staff-leave" element={<StaffLeaveAccess><StaffLeave/></StaffLeaveAccess>}/>
        <Route path="/requests" element={<Navigate to="/staff-leave?tab=other" replace/>}/>
        <Route path="/directory" element={<Directory/>}/>
        <Route path="/resources" element={<Resources/>}/>
        <Route path="/manager" element={<ManagerHubAccess><ManagerHub/></ManagerHubAccess>}/>
        <Route path="/reports" element={<ReportsAccess><Reports/></ReportsAccess>}/>
        <Route path="/email-status" element={<OpsOnly><EmailStatus/></OpsOnly>}/>
        <Route path="/admin/center-tests" element={<CenterTestsAdminAccess><AdminCenterTests/></CenterTestsAdminAccess>}/>
        <Route path="/import" element={<ImportAccess><ImportPage/></ImportAccess>}/>
        <Route path="/admin" element={<SystemAdminOnly><Admin/></SystemAdminOnly>}/>
        <Route path="/leave-balance" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
        <Route path="/purchases" element={<PurchasesAccess><Purchases/></PurchasesAccess>}/>
        <Route path="/employees-purchases" element={<Navigate to="/purchases" replace/>}/>
        <Route path="/employee-purchases" element={<Navigate to="/purchases" replace/>}/>
        <Route path="/purchase" element={<Navigate to="/purchases" replace/>}/>
        <Route path="/purchase-requests" element={<Navigate to="/purchases" replace/>}/>
        <Route path="/leaves" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
        <Route path="/leave-requests" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
        <Route path="/therapist-leaves" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/home" replace/>}/>
    </Routes>
  );
}

class ErrorBoundary extends Component {
  state = { err: null, reloading: false };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) {
    console.error("Portal render error:", err);
    if (isChunkLoadError(err)) {
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
          this.setState({ reloading: true });
          window.location.reload();
        }
      } catch { /* ignore */ }
    }
  }
  render() {
    if (this.state.err) {
      const msg = this.state.err?.message || String(this.state.err);
      const chunkMiss = isChunkLoadError(this.state.err);
      let alreadyTriedReload = false;
      try { alreadyTriedReload = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1"; } catch { /* ignore */ }
      if (this.state.reloading || (chunkMiss && !alreadyTriedReload)) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-organic p-6">
            <div className="card p-8 max-w-md text-center">
              <div className="font-display text-xl mb-2" style={{ color: "#2C3625" }}>Updating…</div>
              <p className="text-sm mb-4" style={{ color: "#5C6853" }}>
                A new version of the portal was deployed. Reloading to load the latest files.
              </p>
              <div className="spinner mx-auto" />
            </div>
          </div>
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-organic p-6">
          <div className="card p-8 max-w-md text-center">
            <div className="font-display text-xl mb-2" style={{ color: "#2C3625" }}>
              {chunkMiss ? "Update required" : "Something went wrong"}
            </div>
            <p className="text-sm mb-2" style={{ color: "#5C6853" }}>
              {chunkMiss
                ? "The app was updated. Reload this page to continue."
                : "The app could not load this page. Try clearing site data and signing in again."}
            </p>
            {!chunkMiss && (
              <p className="text-xs mb-4 break-words" style={{ color: "#8A3F27" }}>{msg}</p>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* ignore */ }
                  window.location.reload();
                }}
              >
                Reload page
              </button>
              {!chunkMiss && (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => { this.setState({ err: null }); window.location.href = "/home"; }}>
                    Go Home
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => { localStorage.removeItem("bg_token"); window.location.href = "/login"; }}>
                    Back to Login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes/>
          <AuthenticatedFileViewer/>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
