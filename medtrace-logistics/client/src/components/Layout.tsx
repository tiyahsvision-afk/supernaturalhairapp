import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isDispatcher = user?.role === "admin" || user?.company_role === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white font-bold">
                M
              </div>
              <span className="text-lg font-semibold text-slate-900">MedTrace Logistics</span>
            </div>
            <nav className="flex gap-1">
              {isDispatcher ? (
                <>
                  <NavItem to="/dashboard" label="Dispatch Board" />
                  <NavItem to="/drivers" label="Drivers" />
                  <NavItem to="/company" label="Company" />
                </>
              ) : (
                <>
                  <NavItem to="/my-orders" label="My Deliveries" />
                  <NavItem to="/messages" label="Messages" />
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user?.name}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
