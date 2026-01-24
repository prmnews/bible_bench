"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StepStatus = "idle" | "running" | "success" | "error";

type StepResult = {
  status: StepStatus;
  message?: string;
  data?: unknown;
};

// Dimension types for scope selection
type Language = { id: number; isoCode: string; name: string };
type Bible = { id: number; languageId: number; name: string; source: string };
type Book = { id: number; bibleId: number; code: string; name: string; index: number };
type Chapter = {
  id: number;
  bibleId: number;
  bookId: number;
  number: number;
  reference: string;
  name: string;
  verseCount: number;
};
type Model = {
  modelId: number;
  displayName: string;
  provider: string;
  isActive: boolean;
};
type Campaign = {
  campaignId: number;
  campaignTag: string;
  campaignName: string;
  campaignDescription: string | null;
  campaignPurposeStatement: string | null;
  campaignManager: string | null;
  isActive: boolean;
  isApproved: boolean;
  isVisible: boolean;
};

function StatusBadge({ status }: { status: StepStatus }) {
  const styles: Record<StepStatus, string> = {
    idle: "bg-muted text-muted-foreground",
    running: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
    error: "bg-destructive/10 text-destructive",
  };

  const labels: Record<StepStatus, string> = {
    idle: "Ready",
    running: "Running...",
    success: "Success",
    error: "Error",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function EtlStep({
  title,
  description,
  buttonLabel,
  result,
  onRun,
  disabled,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  result: StepResult;
  onRun: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">{title}</h3>
            <StatusBadge status={result.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {result.message && (
            <p
              className={`mt-2 text-sm ${
                result.status === "error" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {result.message}
            </p>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={disabled || result.status === "running"}
          className="ml-4 shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {result.status === "running" ? "Running..." : buttonLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MODEL RUN SCOPE PANEL
// ============================================================================

function ModelRunScopePanel() {
  // Dimension data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [bibles, setBibles] = useState<Bible[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  // Selected values
  const [selectedCampaignTag, setSelectedCampaignTag] = useState<string | null>(null);
  const [selectedLanguageId, setSelectedLanguageId] = useState<number | null>(null);
  const [selectedBibleId, setSelectedBibleId] = useState<number | null>(null);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<number>>(new Set());
  const [selectedModelIds, setSelectedModelIds] = useState<Set<number>>(new Set());

  // UI state
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<StepResult>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  // Progress tracking state
  // Maps runId -> modelId for tracking which model each run belongs to
  const [runModelMap, setRunModelMap] = useState<Map<string, number>>(new Map());
  const [currentRunIds, setCurrentRunIds] = useState<string[]>([]);
  // Changed: Now tracks per-model progress: Map<modelId, Map<chapterId, status>>
  const [modelChapterProgress, setModelChapterProgress] = useState<Map<number, Map<number, string>>>(new Map());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load campaigns on mount
  useEffect(() => {
    async function loadCampaigns() {
      try {
        const res = await fetch("/api/admin/campaigns?isActive=true");
        const json = await res.json();
        if (json.ok) {
          setCampaigns(json.data);
          // Auto-select first active campaign
          if (json.data.length > 0) {
            setSelectedCampaignTag(json.data[0].campaignTag);
          }
        }
      } catch (err) {
        console.error("Failed to load campaigns:", err);
      }
    }
    loadCampaigns();
  }, []);

  // Load languages on mount
  useEffect(() => {
    async function loadLanguages() {
      try {
        const res = await fetch("/api/admin/dimensions/languages");
        const json = await res.json();
        if (json.ok) {
          setLanguages(json.data);
          // Auto-select first language
          if (json.data.length > 0) {
            setSelectedLanguageId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load languages:", err);
      }
    }
    loadLanguages();
  }, []);

  // Load models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch("/api/admin/models");
        const json = await res.json();
        if (json.ok) {
          const activeModels = json.data.filter((m: Model) => m.isActive);
          setModels(activeModels);
        }
      } catch (err) {
        console.error("Failed to load models:", err);
      }
    }
    loadModels();
  }, []);

  // Load bibles when language changes
  useEffect(() => {
    if (!selectedLanguageId) {
      setBibles([]);
      return;
    }

    async function loadBibles() {
      try {
        const res = await fetch(
          `/api/admin/dimensions/bibles?languageId=${selectedLanguageId}`
        );
        const json = await res.json();
        if (json.ok) {
          setBibles(json.data);
          // Auto-select first bible
          if (json.data.length > 0) {
            setSelectedBibleId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load bibles:", err);
      }
    }
    loadBibles();
  }, [selectedLanguageId]);

  // Load books when bible changes
  useEffect(() => {
    if (!selectedBibleId) {
      setBooks([]);
      setSelectedBookIds(new Set());
      return;
    }

    async function loadBooks() {
      try {
        const res = await fetch(
          `/api/admin/dimensions/books?bibleId=${selectedBibleId}`
        );
        const json = await res.json();
        if (json.ok) {
          setBooks(json.data);
          setSelectedBookIds(new Set());
          setSelectedChapterIds(new Set());
        }
      } catch (err) {
        console.error("Failed to load books:", err);
      }
    }
    loadBooks();
  }, [selectedBibleId]);

  // Load chapters when book selection changes
  useEffect(() => {
    if (selectedBookIds.size === 0) {
      setChapters([]);
      setSelectedChapterIds(new Set());
      return;
    }

    async function loadChapters() {
      try {
        const allChapters: Chapter[] = [];
        for (const bookId of selectedBookIds) {
          const res = await fetch(
            `/api/admin/dimensions/chapters?bookId=${bookId}`
          );
          const json = await res.json();
          if (json.ok) {
            allChapters.push(...json.data);
          }
        }
        setChapters(allChapters);
      } catch (err) {
        console.error("Failed to load chapters:", err);
      }
    }
    loadChapters();
  }, [selectedBookIds]);

  // Polling for run progress
  useEffect(() => {
    if (!isRunning || currentRunIds.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const pollProgress = async () => {
      // Build per-model progress map
      const newModelProgress = new Map<number, Map<number, string>>();
      let allComplete = true;

      for (const runId of currentRunIds) {
        const modelId = runModelMap.get(runId);
        if (!modelId) continue;

        try {
          const res = await fetch(`/api/admin/runs/${runId}/items`);
          const json = await res.json();
          if (json.ok) {
            const runStatus = json.data.status;

            // Check if this run is still in progress
            if (runStatus === "running") {
              allComplete = false;
            }

            // Get or create the chapter map for this model
            let modelChapters = newModelProgress.get(modelId);
            if (!modelChapters) {
              modelChapters = new Map<number, string>();
              newModelProgress.set(modelId, modelChapters);
            }

            // Update chapter progress from items for this specific model
            for (const item of json.data.items) {
              const existingStatus = modelChapters.get(item.targetId);
              // If already marked as success/failed, don't overwrite
              if (!existingStatus || existingStatus === "pending") {
                modelChapters.set(item.targetId, item.status);
              }
            }
          }
        } catch (err) {
          console.error("Failed to poll progress:", err);
        }
      }

      setModelChapterProgress(newModelProgress);

      // If all runs complete, stop polling and update result
      if (allComplete) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsRunning(false);

        // Count successes and failures across all models
        let successCount = 0;
        let failedCount = 0;
        for (const modelChapters of newModelProgress.values()) {
          for (const status of modelChapters.values()) {
            if (status === "success") successCount++;
            if (status === "failed") failedCount++;
          }
        }

        setRunResult({
          status: failedCount > 0 ? "error" : "success",
          message: `Completed: ${successCount} chapters successful, ${failedCount} failed`,
        });
      }
    };

    // Initial poll immediately
    pollProgress();

    // Then poll every 2 seconds
    pollingRef.current = setInterval(pollProgress, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isRunning, currentRunIds, runModelMap]);

  // Cancel run handler
  const handleCancelRun = async () => {
    if (currentRunIds.length === 0) return;

    setIsCancelling(true);
    try {
      // Cancel all active runs
      for (const runId of currentRunIds) {
        await fetch(`/api/admin/runs/${runId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }

      setShowCancelModal(false);
      setRunResult({
        status: "error",
        message: "Run cancelled by user. Waiting for current chapter to complete...",
      });
    } catch (err) {
      console.error("Failed to cancel run:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  // Get chapter pill class based on progress status for a specific model
  const getChapterPillClassForModel = (chapterId: number, modelId: number) => {
    const modelChapters = modelChapterProgress.get(modelId);
    const status = modelChapters?.get(chapterId);
    if (status === "success") return "bg-green-500 text-white";
    if (status === "failed") return "bg-red-500 text-white";
    if (status === "running") return "bg-yellow-500 animate-pulse text-white";
    if (status === "pending") return "bg-yellow-500/60 text-white";
    return "bg-muted text-muted-foreground";
  };

  // Get chapter pill class for selection UI (when not running)
  const getChapterPillClass = (chapterId: number) => {
    if (selectedChapterIds.has(chapterId)) return "bg-accent text-accent-foreground";
    return "bg-muted text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground";
  };

  // Handlers
  const handleBookToggle = (bookId: number) => {
    const newSet = new Set(selectedBookIds);
    if (newSet.has(bookId)) {
      newSet.delete(bookId);
      // Remove chapters for this book
      const bookChapters = chapters.filter((ch) => ch.bookId === bookId);
      const newChapterSet = new Set(selectedChapterIds);
      for (const ch of bookChapters) {
        newChapterSet.delete(ch.id);
      }
      setSelectedChapterIds(newChapterSet);
    } else {
      newSet.add(bookId);
    }
    setSelectedBookIds(newSet);
  };

  const handleSelectAllBooks = () => {
    const allBookIds = new Set(books.map((b) => b.id));
    setSelectedBookIds(allBookIds);
  };

  const handleClearBooks = () => {
    setSelectedBookIds(new Set());
    setSelectedChapterIds(new Set());
  };

  const handleChapterToggle = (chapterId: number) => {
    const newSet = new Set(selectedChapterIds);
    if (newSet.has(chapterId)) {
      newSet.delete(chapterId);
    } else {
      newSet.add(chapterId);
    }
    setSelectedChapterIds(newSet);
  };

  const handleSelectAllChaptersForBook = (bookId: number) => {
    const bookChapters = chapters.filter((ch) => ch.bookId === bookId);
    const newSet = new Set(selectedChapterIds);
    for (const ch of bookChapters) {
      newSet.add(ch.id);
    }
    setSelectedChapterIds(newSet);
  };

  const handleClearChaptersForBook = (bookId: number) => {
    const bookChapters = chapters.filter((ch) => ch.bookId === bookId);
    const newSet = new Set(selectedChapterIds);
    for (const ch of bookChapters) {
      newSet.delete(ch.id);
    }
    setSelectedChapterIds(newSet);
  };

  const handleModelToggle = (modelId: number) => {
    const newSet = new Set(selectedModelIds);
    if (newSet.has(modelId)) {
      newSet.delete(modelId);
    } else {
      newSet.add(modelId);
    }
    setSelectedModelIds(newSet);
  };

  const handleSelectAllModels = () => {
    setSelectedModelIds(new Set(models.map((m) => m.modelId)));
  };

  const handleClearModels = () => {
    setSelectedModelIds(new Set());
  };

  const handleStartRun = async () => {
    if (!selectedCampaignTag) {
      setError("Please select a campaign.");
      return;
    }
    if (selectedChapterIds.size === 0 || selectedModelIds.size === 0) {
      setError("Please select at least one chapter and one model.");
      return;
    }

    // Initialize per-model progress tracking - mark selected chapters as pending for each model
    const initialModelProgress = new Map<number, Map<number, string>>();
    for (const modelId of selectedModelIds) {
      const chapterMap = new Map<number, string>();
      for (const chapterId of selectedChapterIds) {
        chapterMap.set(chapterId, "pending");
      }
      initialModelProgress.set(modelId, chapterMap);
    }
    setModelChapterProgress(initialModelProgress);
    setRunModelMap(new Map());
    setCurrentRunIds([]);
    setIsRunning(true);
    setError(null);
    setRunResult({ status: "running", message: "Starting runs..." });

    try {
      const res = await fetch("/api/admin/models/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignTag: selectedCampaignTag,
          modelIds: Array.from(selectedModelIds),
          scope: "chapter",
          scopeIds: { chapterIds: Array.from(selectedChapterIds) },
        }),
      });

      const json = await res.json();
      if (json.ok) {
        // Extract run IDs and build runId -> modelId mapping
        const runIds: string[] = [];
        const newRunModelMap = new Map<string, number>();

        for (const result of json.data.results) {
          if (result.ok && result.runId) {
            runIds.push(result.runId);
            newRunModelMap.set(result.runId, result.modelId);
          }
        }

        if (runIds.length > 0) {
          setRunModelMap(newRunModelMap);
          setCurrentRunIds(runIds);
          setRunResult({
            status: "running",
            message: `Running ${runIds.length} run(s) across ${selectedModelIds.size} model(s)...`,
          });
        } else {
          // All runs completed synchronously (or failed to start)
          setIsRunning(false);
          setRunResult({
            status: json.data.summary.failed > 0 ? "error" : "success",
            message: `Completed: ${json.data.summary.success} runs successful, ${json.data.summary.failed} failed`,
            data: json.data,
          });
        }
      } else {
        setIsRunning(false);
        setRunResult({
          status: "error",
          message: json.error ?? "Run failed",
        });
      }
    } catch (err) {
      setIsRunning(false);
      setRunResult({
        status: "error",
        message: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  // Group chapters by book for display
  const chaptersByBook = new Map<number, Chapter[]>();
  for (const ch of chapters) {
    const bookChapters = chaptersByBook.get(ch.bookId) ?? [];
    bookChapters.push(ch);
    chaptersByBook.set(ch.bookId, bookChapters);
  }

  const totalRuns = selectedChapterIds.size * selectedModelIds.size;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">Model Run Scope</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select chapters and models to run evaluation
        </p>
      </div>

      <div className="space-y-4 p-4">
        {/* Campaign Selector */}
        <div>
          <label className="block text-sm font-medium text-foreground">
            Campaign
          </label>
          <select
            value={selectedCampaignTag ?? ""}
            onChange={(e) =>
              setSelectedCampaignTag(e.target.value || null)
            }
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select campaign...</option>
            {campaigns.map((campaign) => (
              <option key={campaign.campaignId} value={campaign.campaignTag}>
                {campaign.campaignTag} - {campaign.campaignName}
              </option>
            ))}
          </select>
          {selectedCampaignTag && campaigns.length > 0 && (
            <div className="mt-2 rounded border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {(() => {
                const c = campaigns.find((x) => x.campaignTag === selectedCampaignTag);
                if (!c) return null;
                return (
                  <>
                    {c.campaignPurposeStatement && (
                      <div><strong>Purpose:</strong> {c.campaignPurposeStatement}</div>
                    )}
                    {c.campaignManager && (
                      <div><strong>Manager:</strong> {c.campaignManager}</div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Language & Bible Selectors */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground">
              Language
            </label>
            <select
              value={selectedLanguageId ?? ""}
              onChange={(e) =>
                setSelectedLanguageId(e.target.value ? Number(e.target.value) : null)
              }
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select language...</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground">
              Bible
            </label>
            <select
              value={selectedBibleId ?? ""}
              onChange={(e) =>
                setSelectedBibleId(e.target.value ? Number(e.target.value) : null)
              }
              disabled={!selectedLanguageId}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">Select bible...</option>
              {bibles.map((bible) => (
                <option key={bible.id} value={bible.id}>
                  {bible.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Books Selection */}
        {selectedBibleId && books.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Books ({selectedBookIds.size} selected)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAllBooks}
                  className="text-xs text-primary hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={handleClearBooks}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="mt-2 grid max-h-40 grid-cols-4 gap-1 overflow-y-auto rounded border border-border bg-muted p-2">
              {books.map((book) => (
                <label
                  key={book.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm",
                    selectedBookIds.has(book.id)
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/20 hover:text-accent-foreground"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedBookIds.has(book.id)}
                    onChange={() => handleBookToggle(book.id)}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  <span className="truncate">{book.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Chapters Selection */}
        {selectedBookIds.size > 0 && chapters.length > 0 && (
          <div>
            <label className="text-sm font-medium text-foreground">
              Chapters ({selectedChapterIds.size} selected)
            </label>
            <div className="mt-2 max-h-60 space-y-2 overflow-y-auto rounded border border-border bg-muted p-2">
              {Array.from(chaptersByBook.entries()).map(([bookId, bookChapters]) => {
                const book = books.find((b) => b.id === bookId);
                const selectedInBook = bookChapters.filter((ch) =>
                  selectedChapterIds.has(ch.id)
                ).length;
                return (
                  <div key={bookId} className="rounded bg-card p-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {book?.name ?? `Book ${bookId}`}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({selectedInBook}/{bookChapters.length})
                        </span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSelectAllChaptersForBook(bookId)}
                          className="text-xs text-primary hover:underline"
                        >
                          All
                        </button>
                        <button
                          onClick={() => handleClearChaptersForBook(bookId)}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {bookChapters.map((ch) => (
                        <label
                          key={ch.id}
                          className={cn(
                            "cursor-pointer rounded px-2 py-1 text-xs transition-colors",
                            getChapterPillClass(ch.id)
                          )}
                          title={ch.name}
                        >
                          <input
                            type="checkbox"
                            checked={selectedChapterIds.has(ch.id)}
                            onChange={() => handleChapterToggle(ch.id)}
                            className="sr-only"
                            disabled={isRunning}
                          />
                          {ch.number}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Models Selection */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Models ({selectedModelIds.size} selected)
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAllModels}
                className="text-xs text-primary hover:underline"
              >
                Select all
              </button>
              <button
                onClick={handleClearModels}
                className="text-xs text-muted-foreground hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {models.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active models found. Add models in the Models page.
              </p>
            ) : (
              models.map((model) => (
                <label
                  key={model.modelId}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-sm ${
                    selectedModelIds.has(model.modelId)
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModelIds.has(model.modelId)}
                    onChange={() => handleModelToggle(model.modelId)}
                    className="sr-only"
                  />
                  {model.displayName}
                </label>
              ))
            )}
          </div>
        </div>

        {/* Per-Model Progress Visualization */}
        {(isRunning || runResult.status === "success" || runResult.status === "error") && modelChapterProgress.size > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-medium text-foreground">Progress by Model</h3>
            <div className="space-y-3">
              {Array.from(selectedModelIds).map((modelId) => {
                const model = models.find((m) => m.modelId === modelId);
                const modelChapters = modelChapterProgress.get(modelId);
                const chaptersForModel = chapters.filter((ch) => selectedChapterIds.has(ch.id));
                
                // Count statuses for this model
                const successCount = modelChapters 
                  ? Array.from(modelChapters.values()).filter(s => s === "success").length 
                  : 0;
                const failedCount = modelChapters 
                  ? Array.from(modelChapters.values()).filter(s => s === "failed").length 
                  : 0;
                const runningCount = modelChapters 
                  ? Array.from(modelChapters.values()).filter(s => s === "running").length 
                  : 0;
                const totalChapters = selectedChapterIds.size;
                
                return (
                  <div key={modelId} className="rounded bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {model?.displayName ?? `Model ${modelId}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({model?.provider})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {runningCount > 0 && (
                          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                            <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                            {runningCount} running
                          </span>
                        )}
                        <span className="text-green-600 dark:text-green-400">
                          {successCount}/{totalChapters} complete
                        </span>
                        {failedCount > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            {failedCount} failed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {chaptersForModel
                        .sort((a, b) => a.number - b.number)
                        .map((ch) => (
                          <span
                            key={ch.id}
                            className={cn(
                              "inline-flex items-center justify-center min-w-[28px] rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
                              getChapterPillClassForModel(ch.id, modelId)
                            )}
                            title={ch.name}
                          >
                            {ch.number}
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Run result */}
        {runResult.status !== "idle" && (
          <div
            className={`rounded border px-3 py-2 text-sm ${
              runResult.status === "success"
                ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                : runResult.status === "error"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{runResult.message ?? (runResult.status === "running" ? "Running..." : "")}</span>
              {runResult.status === "running" && modelChapterProgress.size > 0 && (
                <span className="text-xs opacity-75">
                  {(() => {
                    let total = 0;
                    let complete = 0;
                    for (const modelChapters of modelChapterProgress.values()) {
                      for (const status of modelChapters.values()) {
                        total++;
                        if (status === "success" || status === "failed") complete++;
                      }
                    }
                    return `${complete} / ${total} complete`;
                  })()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Run button */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            {totalRuns > 0 && selectedCampaignTag
              ? `${selectedChapterIds.size} chapter${selectedChapterIds.size !== 1 ? "s" : ""} x ${selectedModelIds.size} model${selectedModelIds.size !== 1 ? "s" : ""} = ${totalRuns} run${totalRuns !== 1 ? "s" : ""}`
              : "Select campaign, chapters, and models to start"}
          </span>
          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleStartRun}
              disabled={isRunning || !selectedCampaignTag || selectedChapterIds.size === 0 || selectedModelIds.size === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? "Running..." : "Start Model Run"}
            </button>
          </div>
        </div>

        {/* Cancel Confirmation Modal */}
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Run?</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this run? The current chapter will complete, 
                but remaining chapters will not be processed. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent/20"
              >
                Keep Running
              </button>
              <button
                onClick={handleCancelRun}
                disabled={isCancelling}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel Run"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function AdminEtlPage() {
  const [schemaResult, setSchemaResult] = useState<StepResult>({
    status: "idle",
  });
  const [seedResult, setSeedResult] = useState<StepResult>({ status: "idle" });
  const [ingestResult, setIngestResult] = useState<StepResult>({
    status: "idle",
  });
  const [chaptersResult, setChaptersResult] = useState<StepResult>({
    status: "idle",
  });
  const [versesResult, setVersesResult] = useState<StepResult>({
    status: "idle",
  });
  const [aggregationsResult, setAggregationsResult] = useState<StepResult>({
    status: "idle",
  });

  const runStep = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      setResult: (result: StepResult) => void
    ) => {
      setResult({ status: "running" });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.ok) {
          setResult({
            status: "success",
            message: JSON.stringify(json.data, null, 2),
            data: json.data,
          });
        } else {
          setResult({
            status: "error",
            message: json.error ?? "Unknown error",
          });
        }
      } catch (err) {
        setResult({
          status: "error",
          message: err instanceof Error ? err.message : "Request failed",
        });
      }
    },
    []
  );

  const runSchema = useCallback(() => {
    runStep("/api/admin/schema/validators", {}, setSchemaResult);
  }, [runStep]);

  const runSeed = useCallback(() => {
    runStep("/api/admin/seed", {}, setSeedResult);
  }, [runStep]);

  const runIngest = useCallback(() => {
    runStep(
      "/api/admin/ingest/kjv",
      { bibleId: 1001, source: "ABS" },
      setIngestResult
    );
  }, [runStep]);

  const runChapters = useCallback(() => {
    runStep(
      "/api/admin/transform/chapters",
      { transformProfileId: 1 },
      setChaptersResult
    );
  }, [runStep]);

  const runVerses = useCallback(() => {
    runStep(
      "/api/admin/transform/verses",
      { transformProfileId: 1 },
      setVersesResult
    );
  }, [runStep]);

  const runAggregations = useCallback(() => {
    runStep("/api/admin/aggregations", {}, setAggregationsResult);
  }, [runStep]);

  const runAll = useCallback(async () => {
    setSchemaResult({ status: "running" });
    setSeedResult({ status: "idle" });
    setIngestResult({ status: "idle" });
    setChaptersResult({ status: "idle" });
    setVersesResult({ status: "idle" });
    setAggregationsResult({ status: "idle" });

    // Step 1: Schema
    try {
      const schemaRes = await fetch("/api/admin/schema/validators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const schemaJson = await schemaRes.json();
      if (!schemaJson.ok) {
        setSchemaResult({ status: "error", message: schemaJson.error });
        return;
      }
      setSchemaResult({ status: "success", message: "Validators applied" });
    } catch (err) {
      setSchemaResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 2: Seed
    setSeedResult({ status: "running" });
    try {
      const seedRes = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const seedJson = await seedRes.json();
      if (!seedJson.ok) {
        setSeedResult({ status: "error", message: seedJson.error });
        return;
      }
      setSeedResult({
        status: "success",
        message: `Books: ${seedJson.data.books.created} created`,
      });
    } catch (err) {
      setSeedResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 3: Ingest
    setIngestResult({ status: "running" });
    try {
      const ingestRes = await fetch("/api/admin/ingest/kjv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bibleId: 1001, source: "ABS" }),
      });
      const ingestJson = await ingestRes.json();
      if (!ingestJson.ok) {
        setIngestResult({ status: "error", message: ingestJson.error });
        return;
      }
      setIngestResult({
        status: "success",
        message: `Ingested: ${ingestJson.data.ingested} chapters`,
      });
    } catch (err) {
      setIngestResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 4: Transform Chapters
    setChaptersResult({ status: "running" });
    try {
      const chaptersRes = await fetch("/api/admin/transform/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformProfileId: 1 }),
      });
      const chaptersJson = await chaptersRes.json();
      if (!chaptersJson.ok) {
        setChaptersResult({ status: "error", message: chaptersJson.error });
        return;
      }
      setChaptersResult({
        status: "success",
        message: `Processed: ${chaptersJson.data.processed} chapters`,
      });
    } catch (err) {
      setChaptersResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 5: Transform Verses
    setVersesResult({ status: "running" });
    try {
      const versesRes = await fetch("/api/admin/transform/verses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformProfileId: 1 }),
      });
      const versesJson = await versesRes.json();
      if (!versesJson.ok) {
        setVersesResult({ status: "error", message: versesJson.error });
        return;
      }
      setVersesResult({
        status: "success",
        message: `Processed: ${versesJson.data.processed} verses`,
      });
    } catch (err) {
      setVersesResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 6: Update Aggregations
    setAggregationsResult({ status: "running" });
    try {
      const aggRes = await fetch("/api/admin/aggregations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const aggJson = await aggRes.json();
      if (!aggJson.ok) {
        setAggregationsResult({ status: "error", message: aggJson.error });
        return;
      }
      setAggregationsResult({
        status: "success",
        message: `Chapters: ${aggJson.data.chaptersProcessed}, Books: ${aggJson.data.booksProcessed}, Bibles: ${aggJson.data.biblesProcessed}`,
      });
    } catch (err) {
      setAggregationsResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }, []);

  const isAnyRunning = [
    schemaResult,
    seedResult,
    ingestResult,
    chaptersResult,
    versesResult,
    aggregationsResult,
  ].some((r) => r.status === "running");

  return (
    <section className="space-y-8">
      {/* Model Run Scope Panel */}
      <ModelRunScopePanel />

      {/* ETL Pipeline Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">ETL Pipeline</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Initialize the database and run the ETL pipeline.
            </p>
          </div>
          <button
            onClick={runAll}
            disabled={isAnyRunning}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnyRunning ? "Running..." : "Run All Steps"}
          </button>
        </div>

        <div className="space-y-3">
          <EtlStep
          title="1. Apply Schema Validators"
          description="Create/update MongoDB collections with JSON schema validators."
          buttonLabel="Apply"
          result={schemaResult}
          onRun={runSchema}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="2. Seed Dimension Tables"
          description="Create language, bible, book records, and default transform profiles."
          buttonLabel="Seed"
          result={seedResult}
          onRun={runSeed}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="3. Ingest KJV Chapters"
          description="Load raw chapter JSON files from bibles/kjv-english/ into canonicalRawChapters collection."
          buttonLabel="Ingest"
          result={ingestResult}
          onRun={runIngest}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="4. Transform Chapters"
          description="Process raw chapters into canonicalChapters collection with text extraction and hashing."
          buttonLabel="Transform"
          result={chaptersResult}
          onRun={runChapters}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="5. Transform Verses"
          description="Extract verses from raw chapters into canonicalVerses collection."
          buttonLabel="Transform"
          result={versesResult}
          onRun={runVerses}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="6. Update Aggregations"
          description="Recompute aggregation collections (chapters, books, bibles) from verse results."
          buttonLabel="Update"
          result={aggregationsResult}
          onRun={runAggregations}
          disabled={isAnyRunning}
        />
        </div>
      </div>
    </section>
  );
}
