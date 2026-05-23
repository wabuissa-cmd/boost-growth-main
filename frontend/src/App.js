import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
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
import Leaves from "./pages/Leaves";
import TherapistLeaves from "./pages/TherapistLeaves";
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
  if (user.role !== "admin") return <Navigate to="/home" replace />;
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
        <Route path="/requests" element={<Requests/>}/>
        <Route path="/directory" element={<Directory/>}/>
        <Route path="/resources" element={<Resources/>}/>
        <Route path="/reports" element={<AdminOnly><Reports/></AdminOnly>}/>
        <Route path="/import" element={<AdminOnly><ImportPage/></AdminOnly>}/>
        <Route path="/admin" element={<AdminOnly><Admin/></AdminOnly>}/>
        <Route path="/leaves" element={<Leaves/>}/>
        <Route path="/therapist-leaves" element={<AdminOnly><TherapistLeaves/></AdminOnly>}/>
      </Route>
      <Route path="*" element={<Navigate to="/home" replace/>}/>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes/>
      </BrowserRouter>
    </AuthProvider>
  );
}
