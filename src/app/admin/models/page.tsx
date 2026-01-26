"use client";

import { useCallback, useEffect, useState } from "react";

type Model = {
  modelId: number;
  provider: string;
  displayName: string;
  version: string;
  routingMethod: string;
  isActive: boolean;
  apiConfigEncrypted?: {
    model?: string;
    maxTokens?: number;
    systemPromptOverride?: string;
    reasoningEffort?: "low" | "medium" | "high";
  };
};

type ModelFormData = {
  modelId: string;
  provider: string;
  displayName: string;
  version: string;
  routingMethod: string;
  isActive: boolean;
  modelName: string;
  maxTokens: string;
  systemPromptOverride: string;
  reasoningEffort: "low" | "medium" | "high" | "";
};

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "Mock"];

const DEFAULT_FORM: ModelFormData = {
  modelId: "",
  provider: "OpenAI",
  displayName: "",
  version: "",
  routingMethod: "direct",
  isActive: true,
  modelName: "",
  maxTokens: "4096",
  systemPromptOverride: "",
  reasoningEffort: "",
};

// Reasoning model patterns to detect when to show reasoning effort dropdown
const REASONING_MODEL_PATTERNS = [/^o1/i, /^o3/i, /^gpt-5/i, /reasoning/i];

function isReasoningModel(modelName: string): boolean {
  return REASONING_MODEL_PATTERNS.some((pattern) => pattern.test(modelName));
}

function ModelForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  initialData: ModelFormData;
  onSubmit: (data: ModelFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<ModelFormData>(initialData);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Determine if we should show reasoning effort based on provider and model name
  const showReasoningEffort =
    form.provider === "OpenAI" && isReasoningModel(form.modelName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Model ID
          </label>
          <input
            type="number"
            name="modelId"
            value={form.modelId}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Provider
          </label>
          <select
            name="provider"
            value={form.provider}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Display Name
          </label>
          <input
            type="text"
            name="displayName"
            value={form.displayName}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="GPT-4o"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Version
          </label>
          <input
            type="text"
            name="version"
            value={form.version}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="2024-08"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Model Identifier
          </label>
          <input
            type="text"
            name="modelName"
            value={form.modelName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="gpt-4o, claude-sonnet-4-20250514, gemini-2.0-flash"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Max Tokens
          </label>
          <input
            type="number"
            name="maxTokens"
            value={form.maxTokens}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="4096"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        API keys are sourced from environment variables and are not stored in the database.
        Use OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY based on provider.
      </div>

      {/* Advanced Settings */}
      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Advanced Settings</h3>
        
        <div className="space-y-4">
          {/* System Prompt Override */}
          <div>
            <label className="block text-sm font-medium text-foreground">
              System Prompt Override
            </label>
            <textarea
              name="systemPromptOverride"
              value={form.systemPromptOverride}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              placeholder="Leave empty to use default low-effort prompt for retrieval tasks"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Custom system prompt for this model. Leave empty to use the default.
            </p>
          </div>

          {/* Reasoning Effort - only shown for OpenAI reasoning models */}
          {showReasoningEffort && (
            <div>
              <label className="block text-sm font-medium text-foreground">
                Reasoning Effort
              </label>
              <select
                name="reasoningEffort"
                value={form.reasoningEffort}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Default (low for retrieval)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Controls reasoning depth for o1/o3 models. Low is recommended for retrieval tasks.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isActive"
          id="isActive"
          checked={form.isActive}
          onChange={handleChange}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        <label htmlFor="isActive" className="text-sm text-foreground">
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent/20 hover:text-accent-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save Model"}
        </button>
      </div>
    </form>
  );
}

function ModelRow({
  model,
  onEdit,
  onToggle,
  onRun,
  isRunning,
}: {
  model: Model;
  onEdit: () => void;
  onToggle: () => void;
  onRun: (scope: "bible" | "book" | "chapter") => void;
  isRunning: boolean;
}) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <div className="font-medium text-foreground">{model.displayName}</div>
        <div className="text-xs text-muted-foreground">ID: {model.modelId}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {model.provider}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {model.version}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            model.isActive
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          }`}
        >
          {model.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {model.apiConfigEncrypted?.model ?? "-"}
        </code>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className="rounded border border-input px-2 py-1 text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground"
          >
            Edit
          </button>
          <button
            onClick={onToggle}
            className="rounded border border-input px-2 py-1 text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground"
          >
            {model.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => onRun("bible")}
            disabled={isRunning || !model.isActive}
            className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runningModelId, setRunningModelId] = useState<number | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/models");
      const json = await res.json();
      if (json.ok) {
        setModels(json.data);
      } else {
        setError(json.error ?? "Failed to load models.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleSubmit = async (data: ModelFormData) => {
    setIsSubmitting(true);
    try {
      const apiConfigEncrypted: Record<string, unknown> = {};
      if (data.modelName) {
        apiConfigEncrypted.model = data.modelName;
      }
      if (data.maxTokens) {
        apiConfigEncrypted.maxTokens = Number(data.maxTokens);
      }
      // Include system prompt override if provided
      if (data.systemPromptOverride.trim()) {
        apiConfigEncrypted.systemPromptOverride = data.systemPromptOverride.trim();
      }
      // Include reasoning effort if provided (for OpenAI reasoning models)
      if (data.reasoningEffort) {
        apiConfigEncrypted.reasoningEffort = data.reasoningEffort;
      }

      const payload = {
        modelId: Number(data.modelId),
        provider: data.provider,
        displayName: data.displayName,
        version: data.version,
        routingMethod: data.routingMethod,
        isActive: data.isActive,
        apiConfigEncrypted,
      };

      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setShowForm(false);
        setEditingModel(null);
        fetchModels();
      } else {
        setError(json.error ?? "Failed to save model.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save model.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (model: Model) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...model,
          isActive: !model.isActive,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        fetchModels();
      } else {
        setError(json.error ?? "Failed to toggle model.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle model.");
    }
  };

  const handleRun = async (model: Model, scope: "bible" | "book" | "chapter") => {
    setRunningModelId(model.modelId);
    setRunMessage(null);
    try {
      const res = await fetch(`/api/admin/models/${model.modelId}/run/${scope}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bibleId: 1001, limit: 5 }),
      });
      const json = await res.json();
      if (json.ok) {
        setRunMessage(
          `Run completed: ${json.data.metrics?.success ?? 0} success, ${json.data.metrics?.failed ?? 0} failed`
        );
      } else {
        setRunMessage(`Run failed: ${json.error}`);
      }
    } catch (err) {
      setRunMessage(
        `Run failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setRunningModelId(null);
    }
  };

  const openAddForm = () => {
    setEditingModel(null);
    setShowForm(true);
  };

  const openEditForm = (model: Model) => {
    setEditingModel(model);
    setShowForm(true);
  };

  const getFormData = (): ModelFormData => {
    if (editingModel) {
      return {
        modelId: String(editingModel.modelId),
        provider: editingModel.provider,
        displayName: editingModel.displayName,
        version: editingModel.version,
        routingMethod: editingModel.routingMethod,
        isActive: editingModel.isActive,
        modelName: editingModel.apiConfigEncrypted?.model ?? "",
        maxTokens: String(editingModel.apiConfigEncrypted?.maxTokens ?? 4096),
        systemPromptOverride: editingModel.apiConfigEncrypted?.systemPromptOverride ?? "",
        reasoningEffort: editingModel.apiConfigEncrypted?.reasoningEffort ?? "",
      };
    }
    return DEFAULT_FORM;
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Models</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Models</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage LLM models and their API configurations.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Model
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

      {runMessage && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
          {runMessage}
          <button
            onClick={() => setRunMessage(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium text-foreground">
            {editingModel ? "Edit Model" : "Add New Model"}
          </h2>
          <ModelForm
            initialData={getFormData()}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingModel(null);
            }}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {models.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          No models registered yet. Click &quot;Add Model&quot; to create one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Model
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Model ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {models.map((model) => (
                <ModelRow
                  key={model.modelId}
                  model={model}
                  onEdit={() => openEditForm(model)}
                  onToggle={() => handleToggle(model)}
                  onRun={(scope) => handleRun(model, scope)}
                  isRunning={runningModelId === model.modelId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
