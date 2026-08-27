import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BuildingIcon, ChatIcon, ClipboardIcon, TruckIcon, UsersIcon } from "./Icons";

function NavItem({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
          isActive ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
      {icon}
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                <TruckIcon size={18} />
              </div>
              <div>
                <div className="text-base font-bold leading-tight text-slate-900">MedTrace Logistics</div>
                <div className="text-[11px] leading-tight text-slate-400">Pharmacy delivery tracking</div>
              </div>
            </div>
            <nav className="flex gap-1">
              {isDispatcher ? (
                <>
                  <NavItem to="/dashboard" label="Deliveries" icon={<TruckIcon size={16} />} />
                  <NavItem to="/drivers" label="Drivers" icon={<UsersIcon size={16} />} />
                  <NavItem to="/company" label="Company" icon={<BuildingIcon size={16} />} />
                </>
              ) : (
                <>
                  <NavItem to="/my-orders" label="My Deliveries" icon={<ClipboardIcon size={16} />} />
                  <NavItem to="/messages" label="Messages" icon={<ChatIcon size={16} />} />
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">{user?.name}</div>
              <div className="text-[11px] text-slate-400">{isDispatcher ? "Dispatcher" : "Driver"}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">{children}</main>
    </div>
  );
}
