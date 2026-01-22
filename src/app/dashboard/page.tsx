"use client";

import { useEffect, useState } from "react";

type Counts = {
  canonicalRawChapters: number;
  canonicalChapters: number;
  canonicalVerses: number;
  models: number;
  runs: number;
};

type ModelSummary = {
  modelId: number;
  displayName: string;
  perfectRate: number;
  avgFidelity: number;
  evaluatedAt?: string;
};

type RunDetails = {
  runId: string;
  runType: string;
  modelId: number;
  scope: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  failedCount: number;
  durationMs: number | null;
};

type Alert = {
  runId: string;
  errorCode: string;
  message: string;
  timestamp: string;
};

type DashboardData = {
  counts: Counts;
  latestRunId: string | null;
  latestRun: RunDetails | null;
  alerts: Alert[];
  models: ModelSummary[];
};

type CompareRow = {
  rank: number;
  modelId: number;
  displayName: string;
  provider?: string;
  version?: string;
  avgFidelity: number;
  perfectRate: number;
  verseCount: number;
  evaluatedAt?: string;
};

type CompareData = {
  comparison: CompareRow[];
};

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="text-sm font-medium text-zinc-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDuration(ms: number | null) {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [compare, setCompare] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const [dashboardRes, compareRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/dashboard/compare"),
        ]);

        const dashboardJson = await dashboardRes.json();
        const compareJson = await compareRes.json();

        if (!isMounted) return;

        if (!dashboardJson.ok) {
          throw new Error(dashboardJson.error ?? "Failed to load dashboard data");
        }
        if (!compareJson.ok) {
          throw new Error(compareJson.error ?? "Failed to load comparison data");
        }

        setData(dashboardJson.data as DashboardData);
        setCompare(compareJson.data as CompareData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-8">
        <div className="text-sm text-zinc-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-8">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-600">Model scoring and run metrics.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Raw Chapters" value={data.counts.canonicalRawChapters} />
          <StatCard title="Chapters" value={data.counts.canonicalChapters} />
          <StatCard title="Verses" value={data.counts.canonicalVerses} />
          <StatCard title="Models" value={data.counts.models} />
          <StatCard title="Runs" value={data.counts.runs} />
        </div>

        {data.latestRun && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">Latest Run</h2>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                    {data.latestRun.runId.slice(0, 12)}...
                  </code>
                  <StatusBadge status={data.latestRun.status} />
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  Type: {data.latestRun.runType} | Scope: {data.latestRun.scope}
                </div>
                {data.latestRun.failedCount > 0 && (
                  <div className="mt-1 text-sm font-medium text-red-600">
                    Failed Items: {data.latestRun.failedCount}
                  </div>
                )}
                <div className="mt-1 text-sm text-zinc-500">
                  Duration: {formatDuration(data.latestRun.durationMs)}
                </div>
              </div>
            </div>
          </div>
        )}

        {data.alerts.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-medium text-amber-800">Alerts</h2>
            <ul className="mt-2 space-y-2 text-sm text-amber-700">
              {data.alerts.map((alert) => (
                <li key={`${alert.runId}-${alert.errorCode}`}>
                  <span className="font-mono text-xs font-semibold text-amber-800">
                    {alert.errorCode}
                  </span>
                  <span className="text-amber-800"> - </span>
                  {alert.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">Model Summary</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Avg Fidelity</th>
                  <th className="py-2 pr-4">Perfect Rate</th>
                  <th className="py-2 pr-4">Evaluated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.models.map((model) => (
                  <tr key={model.modelId}>
                    <td className="py-2 pr-4 font-medium text-zinc-900">
                      {model.displayName}
                    </td>
                    <td className="py-2 pr-4">{model.avgFidelity.toFixed(2)}</td>
                    <td className="py-2 pr-4">{formatPercent(model.perfectRate)}</td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {model.evaluatedAt ? new Date(model.evaluatedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">Model Rankings</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Rank</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Avg Fidelity</th>
                  <th className="py-2 pr-4">Perfect Rate</th>
                  <th className="py-2 pr-4">Verse Count</th>
                  <th className="py-2 pr-4">Evaluated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(compare?.comparison ?? []).map((row) => (
                  <tr key={row.modelId}>
                    <td className="py-2 pr-4">#{row.rank}</td>
                    <td className="py-2 pr-4 font-medium text-zinc-900">
                      {row.displayName}
                    </td>
                    <td className="py-2 pr-4">{row.avgFidelity.toFixed(2)}</td>
                    <td className="py-2 pr-4">{formatPercent(row.perfectRate)}</td>
                    <td className="py-2 pr-4">{row.verseCount}</td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {row.evaluatedAt ? new Date(row.evaluatedAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
                {compare?.comparison?.length === 0 && (
                  <tr>
                    <td className="py-4 text-zinc-500" colSpan={6}>
                      No aggregates available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
