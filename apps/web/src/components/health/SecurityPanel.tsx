import type { SecurityScan, SecurityVulnerability } from "@sonofcotester/sdk";
import { HealthScoreRing } from "./HealthScoreRing.js";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
  info: "bg-slate-100 text-slate-600",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-50 text-red-600",
  acknowledged: "bg-amber-50 text-amber-600",
  fixed: "bg-emerald-50 text-emerald-600",
  "false-positive": "bg-slate-50 text-slate-500",
};

export function SecurityPanel({
  scan,
  onRescan,
}: {
  scan: SecurityScan | null;
  onRescan: () => void;
}) {
  if (!scan) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
        <p className="text-slate-500">No security scan has been run yet.</p>
        <button onClick={onRescan} className="mt-4 rounded-full bg-ocean px-5 py-2.5 text-sm font-semibold text-white">
          Run Security Scan
        </button>
      </div>
    );
  }

  const { summary, vulnerabilities } = scan;

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-sm">
          <HealthScoreRing score={summary.score} size={160} />
          <p className="mt-3 text-sm font-medium text-slate-500">Security Score</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Vulnerability Summary</h3>
            <button onClick={onRescan} className="rounded-full bg-ocean px-4 py-2 text-xs font-semibold text-white">
              Rescan
            </button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {(["critical", "high", "medium", "low", "info"] as const).map((sev) => (
              <div key={sev} className="text-center">
                <div className={`rounded-2xl p-4 ${SEVERITY_STYLES[sev]}`}>
                  <span className="text-2xl font-bold">{summary[sev]}</span>
                </div>
                <p className="mt-2 text-xs font-medium capitalize text-slate-500">{sev}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-lg font-bold text-slate-900">{summary.total}</p>
              <p className="text-xs text-slate-500">Total Found</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-lg font-bold text-emerald-700">{summary.fixedSinceLastScan}</p>
              <p className="text-xs text-slate-500">Fixed Since Last</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-lg font-bold text-red-600">{summary.newSinceLastScan}</p>
              <p className="text-xs text-slate-500">New Since Last</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Metadata */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Scan Details</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Triggered By</p>
            <p className="font-medium capitalize">{scan.triggeredBy}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Duration</p>
            <p className="font-medium">{scan.duration ? `${(scan.duration / 1000).toFixed(1)}s` : "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Files Scanned</p>
            <p className="font-medium">{scan.totalFilesScanned}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dependencies Audited</p>
            <p className="font-medium">{scan.totalDependenciesAudited}</p>
          </div>
        </div>
      </div>

      {/* Vulnerability Table */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Vulnerabilities ({vulnerabilities.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4">Severity</th>
                <th className="pb-3 pr-4">Title</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">File</th>
                <th className="pb-3 pr-4">CWE</th>
                <th className="pb-3 pr-4">CVSS</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {vulnerabilities.map((vuln) => (
                <tr key={vuln.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[vuln.severity]}`}>
                      {vuln.severity}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-medium text-slate-900 max-w-xs truncate">{vuln.title}</td>
                  <td className="py-3 pr-4 text-slate-600">{vuln.category}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{vuln.file ?? "-"}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{vuln.cweId ?? "-"}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{vuln.cvssScore ?? "-"}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[vuln.status]}`}>
                      {vuln.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
