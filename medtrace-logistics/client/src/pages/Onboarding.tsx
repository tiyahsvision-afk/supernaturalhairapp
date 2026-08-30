import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export function Onboarding() {
  const { joinCompany, logout, user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await joinCompany(code);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Join your company</h1>
        <p className="mb-4 text-sm text-slate-500">
          Hi {user?.name}, enter the join code your dispatcher shared with you to access MedTrace.
        </p>
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. GLRX-2026"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-teal-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Joining…" : "Join company"}
          </button>
        </form>
        <button onClick={logout} className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600">
          Sign out
        </button>
      </div>
    </div>
  );
}
