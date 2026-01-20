"use client";

import { useCallback, useEffect, useState } from "react";

type ConfigItem = {
  key: string;
  value: string;
  modifiedAt: string;
  modifiedBy: string;
};

const CONFIG_KEYS = [
  {
    key: "SHOW_LATEST_ONLY",
    label: "Show Latest Run Only",
    description:
      "When enabled, dashboard only shows results from the latest run per model.",
    type: "boolean",
  },
];

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const results: ConfigItem[] = [];
      for (const { key } of CONFIG_KEYS) {
        try {
          const res = await fetch(`/api/admin/config/${key}`);
          if (res.ok) {
            const json = await res.json();
            if (json.ok && json.data) {
              results.push(json.data);
            }
          }
        } catch {
          // Config not set yet
        }
      }
      setConfigs(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleToggle = async (key: string, currentValue: string) => {
    setSaving(key);
    try {
      const newValue = currentValue === "1" || currentValue === "true" ? "0" : "1";
      const res = await fetch(`/api/admin/config/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
      });
      const json = await res.json();
      if (json.ok) {
        fetchConfigs();
      } else {
        setError(json.error ?? "Failed to update config.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update config.");
    } finally {
      setSaving(null);
    }
  };

  const getValue = (key: string): string => {
    const config = configs.find((c) => c.key === key);
    return config?.value ?? "1";
  };

  const isEnabled = (key: string): boolean => {
    const value = getValue(key);
    return value === "1" || value === "true";
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Configuration</h1>
        <div className="text-sm text-zinc-500">Loading...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Configuration</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage application feature flags and settings.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-4">
        {CONFIG_KEYS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div>
              <div className="font-medium text-zinc-900">{label}</div>
              <div className="text-sm text-zinc-500">{description}</div>
              <div className="mt-1 text-xs text-zinc-400">
                Key: <code className="rounded bg-zinc-100 px-1">{key}</code>
              </div>
            </div>
            <button
              onClick={() => handleToggle(key, getValue(key))}
              disabled={saving === key}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                isEnabled(key) ? "bg-blue-600" : "bg-zinc-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isEnabled(key) ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
