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
    apiKey?: string;
    model?: string;
    maxTokens?: number;
  };
};

type ModelFormData = {
  modelId: string;
  provider: string;
  displayName: string;
  version: string;
  routingMethod: string;
  isActive: boolean;
  apiKey: string;
  modelName: string;
  maxTokens: string;
};

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "Mock"];

const DEFAULT_FORM: ModelFormData = {
  modelId: "",
  provider: "OpenAI",
  displayName: "",
  version: "",
  routingMethod: "direct",
  isActive: true,
  apiKey: "",
  modelName: "",
  maxTokens: "4096",
};

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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Model ID
          </label>
          <input
            type="number"
            name="modelId"
            value={form.modelId}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Provider
          </label>
          <select
            name="provider"
            value={form.provider}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <label className="block text-sm font-medium text-zinc-700">
            Display Name
          </label>
          <input
            type="text"
            name="displayName"
            value={form.displayName}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="GPT-4o"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Version
          </label>
          <input
            type="text"
            name="version"
            value={form.version}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="2024-08"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Model Identifier
          </label>
          <input
            type="text"
            name="modelName"
            value={form.modelName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="gpt-4o, claude-sonnet-4-20250514, gemini-2.0-flash"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Max Tokens
          </label>
          <input
            type="number"
            name="maxTokens"
            value={form.maxTokens}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="4096"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          API Key
        </label>
        <input
          type="password"
          name="apiKey"
          value={form.apiKey}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="sk-..."
        />
        <p className="mt-1 text-xs text-zinc-500">
          Leave blank to keep existing key when editing
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isActive"
          id="isActive"
          checked={form.isActive}
          onChange={handleChange}
          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm text-zinc-700">
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
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
        <div className="font-medium text-zinc-900">{model.displayName}</div>
        <div className="text-xs text-zinc-500">ID: {model.modelId}</div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
        {model.provider}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
        {model.version}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            model.isActive
              ? "bg-green-100 text-green-700"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {model.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
          {model.apiConfigEncrypted?.model ?? "-"}
        </code>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Edit
          </button>
          <button
            onClick={onToggle}
            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {model.isActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => onRun("bible")}
            disabled={isRunning || !model.isActive}
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
      if (data.apiKey) {
        apiConfigEncrypted.apiKey = data.apiKey;
      } else if (editingModel?.apiConfigEncrypted?.apiKey) {
        apiConfigEncrypted.apiKey = editingModel.apiConfigEncrypted.apiKey;
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
        apiKey: "",
        modelName: editingModel.apiConfigEncrypted?.model ?? "",
        maxTokens: String(editingModel.apiConfigEncrypted?.maxTokens ?? 4096),
      };
    }
    return DEFAULT_FORM;
  };

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">Models</h1>
        <div className="text-sm text-zinc-500">Loading...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Models</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage LLM models and their API configurations.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Add Model
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

      {runMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          {runMessage}
          <button
            onClick={() => setRunMessage(null)}
            className="ml-2 text-blue-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="mb-4 text-lg font-medium text-zinc-900">
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
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          No models registered yet. Click &quot;Add Model&quot; to create one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Model
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Model ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
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
