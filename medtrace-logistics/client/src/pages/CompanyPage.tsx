import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { BuildingIcon } from "../components/Icons";
import type { Company } from "../types";

export function CompanyPage() {
  const { data } = useApi<{ company: Company }>("/companies/mine");
  const company = data?.company;

  return (
    <Layout>
      <h1 className="mb-6 flex items-center gap-2.5 text-2xl font-bold text-slate-900">
        <BuildingIcon size={22} className="text-teal-600" />
        Company
      </h1>
      {company ? (
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-lg font-bold text-slate-900">{company.name}</p>
          <p className="text-sm text-slate-500">
            {company.address}, {company.city}, {company.state}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Industry</dt>
              <dd className="font-medium text-slate-900">{company.industry || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">License #</dt>
              <dd className="font-medium text-slate-900">{company.license_number || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Contact phone</dt>
              <dd className="font-medium text-slate-900">{company.contact_phone || "—"}</dd>
            </div>
          </dl>
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Team join code</p>
            <p className="mt-0.5 font-mono text-xl font-bold text-teal-900">{company.join_code}</p>
            <p className="mt-1.5 text-xs text-teal-700">Share this with a new driver so they can join {company.name}.</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Loading…</p>
      )}
    </Layout>
  );
}
