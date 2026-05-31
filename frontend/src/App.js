import { Component } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, isClientLead } from "./auth";
import Login from "./pages/Login";
import Shell from "./pages/Shell";
import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Attendance from "./pages/Attendance";
import Clients from "./pages/Clients";
import Requests from "./pages/Requests";
import Directory from "./pages/Directory";
import Intake from "./pages/Intake";
import Resources from "./pages/Resources";
import Admin from "./pages/Admin";
import Reports from "./pages/Reports";
import ImportPage from "./pages/Import";
import LeaveBalance from "./pages/LeaveBalance";
import LeaveRequests from "./pages/LeaveRequests";
import "./App.css";

function Loading() {
  return <div className="min-h-screen flex items-center justify-center bg-organic"><div className="spinner"/></div>;
}

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" || isClientLead(user)) return <Navigate to="/home" replace />;
  return children;
}


function MyLeavesOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loading/>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/home" replace/> : <Login/>}/>
      <Route element={<Protected><Shell/></Protected>}>
        <Route path="/" element={<Navigate to="/home" replace/>}/>
        <Route path="/home" element={<Home/>}/>
        <Route path="/schedule" element={<Schedule/>}/>
        <Route path="/attendance" element={<Attendance/>}/>
        <Route path="/clients" element={<Clients/>}/>
        <Route path="/intake" element={<AdminOnly><Intake/></AdminOnly>}/>
        <Route path="/my-requests" element={<Requests personal/>}/>
        <Route path="/requests" element={<AdminOnly><Requests/></AdminOnly>}/>
        <Route path="/directory" element={<Directory/>}/>
        <Route path="/resources" element={<Resources/>}/>
        <Route path="/reports" element={<AdminOnly><Reports/></AdminOnly>}/>
        <Route path="/import" element={<AdminOnly><ImportPage/></AdminOnly>}/>
        <Route path="/admin" element={<AdminOnly><Admin/></AdminOnly>}/>
        <Route path="/leave-balance" element={<AdminOnly><LeaveBalance/></AdminOnly>}/>
        <Route path="/my-leaves" element={<MyLeavesOnly><LeaveRequests personal/></MyLeavesOnly>}/>
        <Route path="/leaves" element={<AdminOnly><LeaveRequests/></AdminOnly>}/>
        <Route path="/leave-requests" element={<Navigate to="/leaves" replace/>}/>
        <Route path="/therapist-leaves" element={<Navigate to="/leave-balance" replace/>}/>
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
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
