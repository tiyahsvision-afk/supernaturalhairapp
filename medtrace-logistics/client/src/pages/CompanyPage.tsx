import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import type { Company } from "../types";

export function CompanyPage() {
  const { data } = useApi<{ company: Company }>("/companies/mine");
  const company = data?.company;

  return (
    <Layout>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Company</h1>
      {company ? (
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-lg font-semibold text-slate-900">{company.name}</p>
          <p className="text-sm text-slate-500">
            {company.address}, {company.city}, {company.state}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Industry</dt>
              <dd className="text-slate-900">{company.industry || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">License #</dt>
              <dd className="text-slate-900">{company.license_number || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Contact phone</dt>
              <dd className="text-slate-900">{company.contact_phone || "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-lg bg-teal-50 p-3">
            <p className="text-xs font-medium text-teal-700">Share this join code with your drivers</p>
            <p className="mt-1 font-mono text-lg font-semibold text-teal-900">{company.join_code}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Loading…</p>
      )}
    </Layout>
  );
}
