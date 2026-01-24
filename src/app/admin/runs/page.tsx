"use client";

import { useCallback, useEffect, useState } from "react";

type Run = {
  runId: string;
  runType: string;
  modelId: number;
  scope: string;
  scopeIds: Record<string, number>;
  status: string;
  startedAt: string;
  completedAt?: string;
  metrics?: {
    total?: number;
    success?: number;
    failed?: number;
    durationMs?: number;
  };
  errorSummary?: {
    failedCount?: number;
    lastError?: string;
  };
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    completed: "bg-green-500/10 text-green-600 dark:text-green-400",
    failed: "bg-destructive/10 text-destructive",
    cancelled: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
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

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms?: number) {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function RunRow({
  run,
  onRetry,
  isRetrying,
}: {
  run: Run;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="whitespace-nowrap px-4 py-3 text-sm">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {run.runId.slice(0, 8)}...
          </code>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {run.runType}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {run.modelId}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {run.scope}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">
          <StatusBadge status={run.status} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {run.metrics?.success ?? 0} / {run.metrics?.total ?? 0}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {formatDuration(run.metrics?.durationMs)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
          {formatDate(run.startedAt)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
          {run.status === "failed" && (run.metrics?.failed ?? 0) > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              disabled={isRetrying}
              className="rounded border border-input px-2 py-1 text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground disabled:opacity-50"
            >
              {isRetrying ? "Retrying..." : "Retry Failed"}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-muted/50 px-4 py-3">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Run ID:</span>{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {run.runId}
                </code>
              </div>
              <div>
                <span className="font-medium">Scope IDs:</span>{" "}
                {JSON.stringify(run.scopeIds)}
              </div>
              {run.completedAt && (
                <div>
                  <span className="font-medium">Completed:</span>{" "}
                  {formatDate(run.completedAt)}
                </div>
              )}
              {run.errorSummary?.lastError && (
                <div className="text-destructive">
                  <span className="font-medium">Last Error:</span>{" "}
                  {run.errorSummary.lastError}
                </div>
              )}
              <div>
                <span className="font-medium">Metrics:</span>{" "}
                Total: {run.metrics?.total ?? 0}, Success:{" "}
                {run.metrics?.success ?? 0}, Failed: {run.metrics?.failed ?? 0}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("runType", typeFilter);

      const url = `/api/admin/runs${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setRuns(json.data);
      } else {
        setError(json.error ?? "Failed to load runs.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleRetry = async (runId: string) => {
    setRetryingRunId(runId);
    try {
      const res = await fetch(`/api/admin/runs/${runId}/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        fetchRuns();
      } else {
        setError(json.error ?? "Retry failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingRunId(null);
    }
  };

  if (loading && runs.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Runs</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Runs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage model run history.
          </p>
        </div>
        <button
          onClick={fetchRuns}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="MODEL_CHAPTER">MODEL_CHAPTER</option>
            <option value="MODEL_VERSE">MODEL_VERSE</option>
          </select>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          No runs found. Execute a model run from the Models page.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Run ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Model
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Scope
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Success
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Started
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {runs.map((run) => (
                <RunRow
                  key={run.runId}
                  run={run}
                  onRetry={() => handleRetry(run.runId)}
                  isRetrying={retryingRunId === run.runId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
