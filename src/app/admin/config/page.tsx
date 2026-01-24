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
  onUpdate: (key: string, value: string) => Promise<boolean>;
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

  const handleSave = async () => {
    const success = await onUpdate(config.key, editValue);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(config.value);
    setIsEditing(false);
  };

  const isEnabled = config.value === "1" || config.value === "true";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium text-foreground">
            {known?.label ?? config.key}
          </div>
          {known?.description && (
            <div className="text-sm text-muted-foreground">{known.description}</div>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Key: <code className="rounded bg-muted px-1">{config.key}</code>
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
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 ${
                isEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
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
                className="rounded-md border border-input bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {config.value.length > 50 ? config.value.slice(0, 50) + "..." : config.value}
              </code>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground"
              >
                Edit
              </button>
            </div>
          )}

          {!isEditing && (
            <button
              onClick={() => onDelete(config.key)}
              disabled={isSaving}
              className="rounded-md border border-destructive/50 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
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
  onAdd: (key: string, value: string) => Promise<boolean>;
  isAdding: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newKey.trim() && newValue.trim()) {
      const success = await onAdd(newKey.trim().toUpperCase(), newValue.trim());
      if (success) {
        setNewKey("");
        setNewValue("");
        setShowForm(false);
      }
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Add Config
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 font-medium text-foreground">Add New Config</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">Key</label>
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            placeholder="MY_CONFIG_KEY"
            pattern="^[A-Z0-9_-]+$"
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Alphanumeric, underscores, hyphens only
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Value</label>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="config value"
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
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
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isAdding}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

  const handleUpdate = async (key: string, value: string): Promise<boolean> => {
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
        return true;
      } else {
        setError(json.error ?? "Failed to update config.");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update config.");
      return false;
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

  const handleAdd = async (key: string, value: string): Promise<boolean> => {
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
        return true;
      } else {
        setError(json.error ?? "Failed to add config.");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add config.");
      return false;
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Configuration</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage application feature flags and settings.
          </p>
        </div>
        <button
          onClick={fetchConfigs}
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

      <NewConfigForm onAdd={handleAdd} isAdding={saving !== null} />

      {configs.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
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
