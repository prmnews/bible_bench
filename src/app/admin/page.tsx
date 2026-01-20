"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Counts = {
  rawChapters: number;
  chapters: number;
  verses: number;
  models: number;
  runs: number;
};

type ModelSummary = {
  modelId: number;
  displayName: string;
  perfectRate: number;
  avgFidelity: number;
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

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-sm font-medium text-zinc-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
      {subtitle && (
        <div className="mt-1 text-xs text-zinc-400">{subtitle}</div>
      )}
    </div>
  );
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

function RunStatusCard({
  run,
  onRetry,
  isRetrying,
}: {
  run: RunDetails;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-900">Last Run</h3>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                {run.runId.length > 20 ? run.runId.slice(0, 20) + "..." : run.runId}
              </code>
              <StatusBadge status={run.status} />
            </div>
            <div className="text-sm text-zinc-600">
              Type: {run.runType} | Scope: {run.scope}
            </div>
            {run.failedCount > 0 && (
              <div className="text-sm font-medium text-red-600">
                Failed Items: {run.failedCount}
              </div>
            )}
            <div className="text-sm text-zinc-500">
              Duration: {formatDuration(run.durationMs)}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {run.failedCount > 0 && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isRetrying ? "Retrying..." : "Retry Failed"}
            </button>
          )}
          <Link
            href="/admin/runs"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            View Runs
          </Link>
          <Link
            href="/admin/etl"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Go to ETL
          </Link>
        </div>
      </div>
    </div>
  );
}

function AlertsSection({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-medium text-amber-800">Alerts</h3>
      <ul className="mt-2 space-y-2">
        {alerts.map((alert, idx) => (
          <li key={`${alert.runId}-${idx}`} className="text-sm">
            <span className="font-mono text-xs font-medium text-amber-700">
              {alert.errorCode}
            </span>
            <span className="text-amber-800"> - </span>
            <span className="text-amber-700">{alert.message}</span>
            <span className="ml-2 text-xs text-amber-600">
              (run: {alert.runId.slice(0, 8)}...)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="flex gap-3">
      <Link
        href="/admin/models"
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Manage Models
      </Link>
      <Link
        href="/admin/etl"
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        ETL Pipeline
      </Link>
      <Link
        href="/admin/runs"
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        View Runs
      </Link>
      <Link
        href="/admin/config"
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Config
      </Link>
    </div>
  );
}

function ModelTable({ models }: { models: ModelSummary[] }) {
  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
        No models registered yet. Add models in the Models page.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Model
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
              Perfect Rate
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
              Avg Fidelity
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {models.map((model) => (
            <tr key={model.modelId}>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900">
                {model.displayName}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-zinc-600">
                {model.perfectRate.toFixed(1)}%
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-zinc-600">
                {model.avgFidelity.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.error ?? "Failed to load dashboard data.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetryFailed = useCallback(async () => {
    if (!data?.latestRun?.runId) return;
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/admin/runs/${data.latestRun.runId}/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        fetchData();
      } else {
        setError(json.error ?? "Retry failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setIsRetrying(false);
    }
  }, [data?.latestRun?.runId, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <div className="text-sm text-zinc-500">Loading...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <button
          onClick={fetchData}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Retry
        </button>
      </section>
    );
  }

  const counts = data?.counts ?? {
    rawChapters: 0,
    chapters: 0,
    verses: 0,
    models: 0,
    runs: 0,
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <button
          onClick={fetchData}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Run Status Card */}
      {data?.latestRun && (
        <RunStatusCard
          run={data.latestRun}
          onRetry={handleRetryFailed}
          isRetrying={isRetrying}
        />
      )}

      {/* Alerts Section */}
      <AlertsSection alerts={data?.alerts ?? []} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          title="Raw Chapters"
          value={counts.rawChapters.toLocaleString()}
          subtitle="Ingested from files"
        />
        <StatCard
          title="Chapters"
          value={counts.chapters.toLocaleString()}
          subtitle="Transformed"
        />
        <StatCard
          title="Verses"
          value={counts.verses.toLocaleString()}
          subtitle="Extracted"
        />
        <StatCard
          title="Models"
          value={counts.models}
          subtitle="Active"
        />
        <StatCard
          title="Runs"
          value={counts.runs}
          subtitle="Total executed"
        />
      </div>

      {/* Model Performance Table */}
      <div>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">
          Model Performance
        </h2>
        <ModelTable models={data?.models ?? []} />
      </div>
    </section>
  );
}
