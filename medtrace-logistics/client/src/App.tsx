import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { DispatcherDashboard } from "./pages/DispatcherDashboard";
import { MapPage } from "./pages/MapPage";
import { DriversPage } from "./pages/DriversPage";
import { CompanyPage } from "./pages/CompanyPage";
import { DriverPortal } from "./pages/DriverPortal";
import { MessagesPage } from "./pages/MessagesPage";

function Home() {
  const { user } = useAuth();
  const isDispatcher = user?.role === "admin" || user?.company_role === "admin";
  return <Navigate to={isDispatcher ? "/dashboard" : "/my-orders"} replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (!user.company_id && user.role !== "admin") {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<DispatcherDashboard />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/drivers" element={<DriversPage />} />
      <Route path="/company" element={<CompanyPage />} />
      <Route path="/my-orders" element={<DriverPortal />} />
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
