"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {subtitle && (
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
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
    running: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    completed: "bg-green-500/10 text-green-600 dark:text-green-400",
    failed: "bg-destructive/10 text-destructive",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-muted text-muted-foreground"
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Last Run</h3>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {run.runId.length > 20 ? run.runId.slice(0, 20) + "..." : run.runId}
              </code>
              <StatusBadge status={run.status} />
            </div>
            <div className="text-sm text-muted-foreground">
              Type: {run.runType} | Scope: {run.scope}
            </div>
            {run.failedCount > 0 && (
              <div className="text-sm font-medium text-destructive">
                Failed Items: {run.failedCount}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Duration: {formatDuration(run.durationMs)}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {run.failedCount > 0 && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isRetrying ? "Retrying..." : "Retry Failed"}
            </button>
          )}
          <Link
            href="/admin/runs"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-center text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground"
          >
            View Runs
          </Link>
          <Link
            href="/admin/etl"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-center text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground"
          >
            Go to ETL
          </Link>
        </div>
      </div>
    </div>
  );
}

function AlertsSection({ 
  alerts, 
  onDismiss,
  onDismissAll,
}: { 
  alerts: Alert[];
  onDismiss: (runId: string, errorCode: string) => void;
  onDismissAll: () => void;
}) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-primary">Alerts</h3>
        <button
          onClick={onDismissAll}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Dismiss All
        </button>
      </div>
      <ul className="mt-2 space-y-2">
        {alerts.map((alert, idx) => (
          <li key={`${alert.runId}-${idx}`} className="flex items-start justify-between gap-2 text-sm">
            <div className="flex-1">
              <span className="font-mono text-xs font-medium text-primary">
                {alert.errorCode}
              </span>
              <span className="text-foreground"> - </span>
              <span className="text-foreground">{alert.message}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                (run: {alert.runId.slice(0, 8)}...)
              </span>
            </div>
            <button
              onClick={() => onDismiss(alert.runId, alert.errorCode)}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground underline"
              aria-label={`Dismiss ${alert.errorCode}`}
            >
              Dismiss
            </button>
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
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground hover:border-accent/50"
      >
        Manage Models
      </Link>
      <Link
        href="/admin/etl"
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground hover:border-accent/50"
      >
        ETL Pipeline
      </Link>
      <Link
        href="/admin/runs"
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground hover:border-accent/50"
      >
        View Runs
      </Link>
      <Link
        href="/admin/config"
        className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground hover:border-accent/50"
      >
        Config
      </Link>
    </div>
  );
}

function ModelTable({ models }: { models: ModelSummary[] }) {
  if (models.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
        No models registered yet. Add models in the Models page.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Model
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Perfect Rate
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Avg Fidelity
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {models.map((model) => (
            <tr key={model.modelId}>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground">
                {model.displayName}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-muted-foreground">
                {model.perfectRate.toFixed(1)}%
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-muted-foreground">
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
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Load dismissed alerts from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("dismissed-alerts");
    if (saved) {
      try {
        setDismissedAlerts(new Set(JSON.parse(saved)));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleDismissAlert = useCallback((runId: string, errorCode: string) => {
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.add(`${runId}-${errorCode}`);
      return next;
    });
  }, []);

  const handleDismissAllAlerts = useCallback(() => {
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      (data?.alerts ?? []).forEach((alert) => {
        next.add(`${alert.runId}-${alert.errorCode}`);
      });
      return next;
    });
  }, [data?.alerts]);

  useEffect(() => {
    localStorage.setItem("dismissed-alerts", JSON.stringify(Array.from(dismissedAlerts)));
  }, [dismissedAlerts]);

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
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
        <button
          onClick={fetchData}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </section>
    );
  }

  const counts = data?.counts ?? {
    canonicalRawChapters: 0,
    canonicalChapters: 0,
    canonicalVerses: 0,
    models: 0,
    runs: 0,
  };

  const visibleAlerts = (data?.alerts ?? []).filter(
    (alert) => !dismissedAlerts.has(`${alert.runId}-${alert.errorCode}`)
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <button
          onClick={fetchData}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground hover:border-accent/50"
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
      <AlertsSection 
        alerts={visibleAlerts} 
        onDismiss={handleDismissAlert}
        onDismissAll={handleDismissAllAlerts}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          title="Canonical Raw Chapters"
          value={counts.canonicalRawChapters.toLocaleString()}
          subtitle="Ingested from files"
        />
        <StatCard
          title="Canonical Chapters"
          value={counts.canonicalChapters.toLocaleString()}
          subtitle="Transformed"
        />
        <StatCard
          title="Canonical Verses"
          value={counts.canonicalVerses.toLocaleString()}
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
        <h2 className="mb-3 text-lg font-medium text-foreground">
          Model Performance
        </h2>
        <ModelTable models={data?.models ?? []} />
      </div>
    </section>
  );
}
