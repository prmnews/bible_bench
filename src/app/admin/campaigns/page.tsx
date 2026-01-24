"use client";

import { useCallback, useEffect, useState } from "react";

type Campaign = {
  campaignId: number;
  campaignTag: string;
  campaignName: string;
  campaignDescription: string | null;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  campaignPurposeStatement: string | null;
  campaignManager: string | null;
  isActive: boolean;
  isApproved: boolean;
  isVisible: boolean;
};

type CampaignFormData = {
  campaignId: string;
  campaignTag: string;
  campaignName: string;
  campaignDescription: string;
  campaignStartDate: string;
  campaignEndDate: string;
  campaignPurposeStatement: string;
  campaignManager: string;
  isActive: boolean;
  isApproved: boolean;
  isVisible: boolean;
};

const DEFAULT_FORM: CampaignFormData = {
  campaignId: "",
  campaignTag: "",
  campaignName: "",
  campaignDescription: "",
  campaignStartDate: "",
  campaignEndDate: "",
  campaignPurposeStatement: "",
  campaignManager: "",
  isActive: true,
  isApproved: false,
  isVisible: true,
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "-";
  }
}

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function CampaignForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  isEditing,
}: {
  initialData: CampaignFormData;
  onSubmit: (data: CampaignFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isEditing: boolean;
}) {
  const [form, setForm] = useState<CampaignFormData>(initialData);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Campaign ID
          </label>
          <input
            type="number"
            name="campaignId"
            value={form.campaignId}
            onChange={handleChange}
            required
            disabled={isEditing}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            placeholder="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Campaign Tag
          </label>
          <input
            type="text"
            name="campaignTag"
            value={form.campaignTag}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="2026-01"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Unique identifier used in runs and aggregations
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Campaign Name
          </label>
          <input
            type="text"
            name="campaignName"
            value={form.campaignName}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="January 2026 Analysis"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Description
        </label>
        <textarea
          name="campaignDescription"
          value={form.campaignDescription}
          onChange={handleChange}
          rows={2}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Brief description of this campaign..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Purpose Statement
        </label>
        <textarea
          name="campaignPurposeStatement"
          value={form.campaignPurposeStatement}
          onChange={handleChange}
          rows={2}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="What is the goal of this analysis campaign?"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Start Date
          </label>
          <input
            type="date"
            name="campaignStartDate"
            value={form.campaignStartDate}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            End Date
          </label>
          <input
            type="date"
            name="campaignEndDate"
            value={form.campaignEndDate}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Campaign Manager
          </label>
          <input
            type="text"
            name="campaignManager"
            value={form.campaignManager}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="John Doe"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
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
            Active (can add new runs)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isApproved"
            id="isApproved"
            checked={form.isApproved}
            onChange={handleChange}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <label htmlFor="isApproved" className="text-sm text-foreground">
            Approved (data verified)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isVisible"
            id="isVisible"
            checked={form.isVisible}
            onChange={handleChange}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <label htmlFor="isVisible" className="text-sm text-foreground">
            Visible (show in dashboards)
          </label>
        </div>
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
          {isSubmitting ? "Saving..." : "Save Campaign"}
        </button>
      </div>
    </form>
  );
}

function CampaignRow({
  campaign,
  onEdit,
  onDelete,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className={!campaign.isActive ? "opacity-60" : ""}>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <div className="font-medium text-foreground">{campaign.campaignName}</div>
        <div className="text-xs text-muted-foreground">
          Tag: <code className="rounded bg-muted px-1">{campaign.campaignTag}</code>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
        {campaign.campaignPurposeStatement ?? "-"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {campaign.campaignManager ?? "-"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {formatDate(campaign.campaignStartDate)} - {formatDate(campaign.campaignEndDate)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <div className="flex gap-1">
          {campaign.isActive && (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
              Active
            </span>
          )}
          {campaign.isApproved && (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
              Approved
            </span>
          )}
          {!campaign.isVisible && (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              Hidden
            </span>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className="rounded border border-input px-2 py-1 text-xs font-medium hover:bg-accent/20 hover:text-accent-foreground"
          >
            Edit
          </button>
          {campaign.isActive && (
            <button
              onClick={onDelete}
              className="rounded border border-destructive/50 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              Archive
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/campaigns");
      const json = await res.json();
      if (json.ok) {
        setCampaigns(json.data);
      } else {
        setError(json.error ?? "Failed to load campaigns.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleSubmit = async (data: CampaignFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        campaignId: Number(data.campaignId),
        campaignTag: data.campaignTag,
        campaignName: data.campaignName,
        isActive: data.isActive,
        isApproved: data.isApproved,
        isVisible: data.isVisible,
      };

      if (data.campaignDescription.trim()) {
        payload.campaignDescription = data.campaignDescription.trim();
      }
      if (data.campaignPurposeStatement.trim()) {
        payload.campaignPurposeStatement = data.campaignPurposeStatement.trim();
      }
      if (data.campaignManager.trim()) {
        payload.campaignManager = data.campaignManager.trim();
      }
      if (data.campaignStartDate) {
        payload.campaignStartDate = new Date(data.campaignStartDate).toISOString();
      }
      if (data.campaignEndDate) {
        payload.campaignEndDate = new Date(data.campaignEndDate).toISOString();
      }

      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setShowForm(false);
        setEditingCampaign(null);
        fetchCampaigns();
      } else {
        setError(json.error ?? "Failed to save campaign.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    if (!confirm(`Are you sure you want to archive "${campaign.campaignName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.campaignId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        fetchCampaigns();
      } else {
        setError(json.error ?? "Failed to archive campaign.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive campaign.");
    }
  };

  const openAddForm = () => {
    setEditingCampaign(null);
    setShowForm(true);
  };

  const openEditForm = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowForm(true);
  };

  const getFormData = (): CampaignFormData => {
    if (editingCampaign) {
      return {
        campaignId: String(editingCampaign.campaignId),
        campaignTag: editingCampaign.campaignTag,
        campaignName: editingCampaign.campaignName,
        campaignDescription: editingCampaign.campaignDescription ?? "",
        campaignStartDate: formatDateForInput(editingCampaign.campaignStartDate),
        campaignEndDate: formatDateForInput(editingCampaign.campaignEndDate),
        campaignPurposeStatement: editingCampaign.campaignPurposeStatement ?? "",
        campaignManager: editingCampaign.campaignManager ?? "",
        isActive: editingCampaign.isActive,
        isApproved: editingCampaign.isApproved,
        isVisible: editingCampaign.isVisible,
      };
    }
    // Auto-generate next campaign ID
    const maxId = campaigns.reduce((max, c) => Math.max(max, c.campaignId), 0);
    return { ...DEFAULT_FORM, campaignId: String(maxId + 1) };
  };

  const filteredCampaigns = showArchived
    ? campaigns
    : campaigns.filter((c) => c.isActive);

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Campaigns</h1>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage analysis campaigns for grouping and comparing model runs across time periods.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add Campaign
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

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium text-foreground">
            {editingCampaign ? "Edit Campaign" : "Add New Campaign"}
          </h2>
          <CampaignForm
            initialData={getFormData()}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCampaign(null);
            }}
            isSubmitting={isSubmitting}
            isEditing={!!editingCampaign}
          />
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          Show archived campaigns
        </label>
        <span className="text-sm text-muted-foreground">
          {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredCampaigns.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          {campaigns.length === 0
            ? 'No campaigns created yet. Click "Add Campaign" to create one.'
            : "No active campaigns. Check \"Show archived\" to see all campaigns."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Campaign
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Purpose
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Manager
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Date Range
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredCampaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.campaignId}
                  campaign={campaign}
                  onEdit={() => openEditForm(campaign)}
                  onDelete={() => handleDelete(campaign)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
