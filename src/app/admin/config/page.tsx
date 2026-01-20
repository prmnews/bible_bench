"use client";

import { useCallback, useEffect, useState } from "react";

type ConfigItem = {
  key: string;
  value: string;
  modifiedAt?: string;
  modifiedBy?: string;
};

// Known config keys with descriptions
const KNOWN_KEYS: Record<string, { label: string; description: string; type: "boolean" | "string" }> = {
  SHOW_LATEST_ONLY: {
    label: "Show Latest Run Only",
    description: "When enabled, dashboard only shows results from the latest run per model.",
    type: "boolean",
  },
};

function formatDate(dateString?: string) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConfigRow({
  config,
  onUpdate,
  onDelete,
  isSaving,
}: {
  config: ConfigItem;
  onUpdate: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  isSaving: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(config.value);

  const known = KNOWN_KEYS[config.key];
  const isBoolean = known?.type === "boolean";

  const handleToggle = () => {
    const newValue = config.value === "1" || config.value === "true" ? "0" : "1";
    onUpdate(config.key, newValue);
  };

  const handleSave = () => {
    onUpdate(config.key, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(config.value);
    setIsEditing(false);
  };

  const isEnabled = config.value === "1" || config.value === "true";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium text-zinc-900">
            {known?.label ?? config.key}
          </div>
          {known?.description && (
            <div className="text-sm text-zinc-500">{known.description}</div>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
            <span>
              Key: <code className="rounded bg-zinc-100 px-1">{config.key}</code>
            </span>
            <span>Modified: {formatDate(config.modifiedAt)}</span>
            {config.modifiedBy && <span>By: {config.modifiedBy}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isBoolean ? (
            <button
              onClick={handleToggle}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                isEnabled ? "bg-blue-600" : "bg-zinc-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          ) : isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="rounded bg-zinc-100 px-2 py-1 text-sm">
                {config.value.length > 50 ? config.value.slice(0, 50) + "..." : config.value}
              </code>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Edit
              </button>
            </div>
          )}

          {!isEditing && (
            <button
              onClick={() => onDelete(config.key)}
              disabled={isSaving}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewConfigForm({
  onAdd,
  isAdding,
}: {
  onAdd: (key: string, value: string) => void;
  isAdding: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKey.trim() && newValue.trim()) {
      onAdd(newKey.trim().toUpperCase(), newValue.trim());
      setNewKey("");
      setNewValue("");
      setShowForm(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Add Config
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="mb-3 font-medium text-zinc-900">Add New Config</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Key</label>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            placeholder="MY_CONFIG_KEY"
            pattern="^[A-Z0-9_-]+$"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Alphanumeric, underscores, hyphens only
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Value</label>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="config value"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setShowForm(false);
            setNewKey("");
            setNewValue("");
          }}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isAdding}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {isAdding ? "Adding..." : "Add Config"}
        </button>
      </div>
    </form>
  );
}

export default function AdminConfigPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/config");
      const json = await res.json();
      if (json.ok) {
        setConfigs(json.data ?? []);
      } else {
        setError(json.error ?? "Failed to load config.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleUpdate = async (key: string, value: string) => {
    setSaving(key);
    try {
      const res = await fetch(`/api/admin/config/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
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

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete config key "${key}"?`)) return;

    setSaving(key);
    try {
      const res = await fetch(`/api/admin/config/${key}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        fetchConfigs();
      } else {
        setError(json.error ?? "Failed to delete config.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete config.");
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async (key: string, value: string) => {
    setSaving(key);
    try {
      const res = await fetch(`/api/admin/config/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const json = await res.json();
      if (json.ok) {
        fetchConfigs();
      } else {
        setError(json.error ?? "Failed to add config.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add config.");
    } finally {
      setSaving(null);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Configuration</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage application feature flags and settings.
          </p>
        </div>
        <button
          onClick={fetchConfigs}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Refresh
        </button>
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

      <NewConfigForm onAdd={handleAdd} isAdding={saving !== null} />

      {configs.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          No configuration keys set. Add one above.
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <ConfigRow
              key={config.key}
              config={config}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              isSaving={saving === config.key}
            />
          ))}
        </div>
      )}
    </section>
  );
}
