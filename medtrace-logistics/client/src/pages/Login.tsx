import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("dispatch@greatlakesrx.com");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-xl font-bold text-white">
            M
          </div>
          <h1 className="text-xl font-semibold text-slate-900">MedTrace Logistics</h1>
          <p className="text-sm text-slate-500">Pharmacy courier &amp; chain-of-custody tracking</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              className={`flex-1 rounded-md py-1.5 font-medium ${mode === "login" ? "bg-white shadow-sm" : "text-slate-500"}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 font-medium ${mode === "register" ? "bg-white shadow-sm" : "text-slate-500"}`}
              onClick={() => setMode("register")}
              type="button"
            >
              Create account
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
        <div className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-500">
          Demo accounts (password <code>password123</code>): dispatch@greatlakesrx.com (dispatcher),
          j.rivera@greatlakesrx.com / s.okafor@greatlakesrx.com (drivers).
        </div>
      </div>
    </div>
  );
}
