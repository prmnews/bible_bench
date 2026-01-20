"use client";

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

type DashboardData = {
  counts: Counts;
  latestRunId: string | null;
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

      <div>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">
          Model Performance
        </h2>
        <ModelTable models={data?.models ?? []} />
      </div>

      {data?.latestRunId && (
        <div className="text-sm text-zinc-500">
          Latest run: <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{data.latestRunId}</code>
        </div>
      )}
    </section>
  );
}
