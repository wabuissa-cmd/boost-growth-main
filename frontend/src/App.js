import { Component, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, isJenan, hasOpsAccess, canAccessPurchases, canEditStaffRequests, canEditIntake, canManageLeaves, canHrReviewLeaves, hasFullClientAccess, showSystemAdmin, canImportData, canViewReports, canViewCenterTests, showMyReportsNav, canViewSupervisionCaseload } from "./auth";
import Login from "./pages/Login";
import Shell from "./pages/Shell";
import AuthenticatedFileViewer from "./components/AuthenticatedFileViewer";
import "./App.css";

const Home = lazy(() => import("./pages/Home"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Clients = lazy(() => import("./pages/Clients"));
const Requests = lazy(() => import("./pages/Requests"));
const TherapistRequests = lazy(() => import("./pages/TherapistRequests"));
const Directory = lazy(() => import("./pages/Directory"));
const Intake = lazy(() => import("./pages/Intake"));
import IntakeWaiting from "./pages/IntakeWaiting";
import SchoolWaiting from "./pages/SchoolWaiting";
const Resources = lazy(() => import("./pages/Resources"));
const Admin = lazy(() => import("./pages/Admin"));
const Reports = lazy(() => import("./pages/Reports"));
const ImportPage = lazy(() => import("./pages/Import"));
const LeaveBalance = lazy(() => import("./pages/LeaveBalance"));
const LeaveRequests = lazy(() => import("./pages/LeaveRequests"));
const StaffLeave = lazy(() => import("./pages/StaffLeave"));
const Billing = lazy(() => import("./pages/Billing"));
const TherapistMyReports = lazy(() => import("./pages/TherapistMyReports"));
const ManagerHub = lazy(() => import("./pages/ManagerHub"));
const Purchases = lazy(() => import("./pages/Purchases"));
const SupervisionCaseload = lazy(() => import("./pages/SupervisionCaseload"));
const DesignPreview = lazy(() => import("./pages/DesignPreview"));
const CenterTest = lazy(() => import("./pages/CenterTest"));
const AdminCenterTests = lazy(() => import("./pages/AdminCenterTests"));

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

function CenterTestsAdminAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canViewCenterTests(user)) return <Navigate to="/home" replace />;
  return children;
}

function ManagerHubAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isJenan(user)) return <Navigate to="/home" replace />;
  return children;
}

function MyReportsAccess({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (!showMyReportsNav(user)) return <Navigate to="/home" replace />;
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
        <Route path="/attendance" element={<Attendance/>}/>
        <Route path="/billing" element={<OpsOnly><Billing/></OpsOnly>}/>
        <Route path="/clients" element={<Clients/>}/>
        <Route path="/supervision" element={<SupervisionAccess><SupervisionCaseload/></SupervisionAccess>}/>
        <Route path="/intake" element={<IntakeAccess><Intake/></IntakeAccess>}/>
        <Route path="/waiting/intake" element={<IntakeAccess><IntakeWaiting/></IntakeAccess>}/>
        <Route path="/waiting/school" element={<IntakeAccess><SchoolWaiting/></IntakeAccess>}/>
        <Route path="/my-requests" element={<TherapistRequests/>}/>
        <Route path="/my-reports" element={<MyReportsAccess><TherapistMyReports/></MyReportsAccess>}/>
        <Route path="/my-leaves" element={<Navigate to="/my-requests" replace/>}/>
        <Route path="/staff-leave" element={<StaffLeaveAccess><StaffLeave/></StaffLeaveAccess>}/>
        <Route path="/requests" element={<Navigate to="/staff-leave?tab=other" replace/>}/>
        <Route path="/directory" element={<Directory/>}/>
        <Route path="/resources" element={<Resources/>}/>
        <Route path="/manager" element={<ManagerHubAccess><ManagerHub/></ManagerHubAccess>}/>
        <Route path="/reports" element={<ReportsAccess><Reports/></ReportsAccess>}/>
        <Route path="/admin/center-tests" element={<CenterTestsAdminAccess><AdminCenterTests/></CenterTestsAdminAccess>}/>
        <Route path="/import" element={<ImportAccess><ImportPage/></ImportAccess>}/>
        <Route path="/admin" element={<SystemAdminOnly><Admin/></SystemAdminOnly>}/>
        <Route path="/leave-balance" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
        <Route path="/purchases" element={<PurchasesAccess><Purchases/></PurchasesAccess>}/>
        <Route path="/leaves" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
        <Route path="/leave-requests" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
        <Route path="/therapist-leaves" element={<Navigate to="/staff-leave?tab=vacation" replace/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/home" replace/>}/>
    </Routes>
  );
}

class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-organic p-6">
          <div className="card p-8 max-w-md text-center">
            <div className="font-display text-xl mb-2" style={{ color: "#2C3625" }}>Something went wrong</div>
            <p className="text-sm mb-4" style={{ color: "#5C6853" }}>
              The app could not load. Try clearing site data and signing in again.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => { localStorage.removeItem("bg_token"); window.location.href = "/login"; }}>
              Back to Login
            </button>
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
