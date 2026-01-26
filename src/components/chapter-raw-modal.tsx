"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Copy,
  Check,
  FileText,
  Code,
  ArrowsLeftRight,
} from "@phosphor-icons/react";
import { diffWords } from "diff";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// ============================================================================
// Types
// ============================================================================

type LlmResponseData = {
  responseId: number;
  runId: string;
  modelId: number;
  modelName: string;
  responseRaw: string;
  parsed: unknown;
  parseError: string | null;
  extractedText: string | null;
  systemPrompt: string | null;
  userPrompt: string | null;
  latencyMs: number | null;
  evaluatedAt: string;
};

type ChapterRawData = {
  chapterId: number;
  reference: string;
  bookId: number;
  bibleId: number;
  canonical: {
    textRaw: string;
    textProcessed: string;
    hashRaw: string;
    hashProcessed: string;
    sourceJson: unknown;
  };
  llmResponse: LlmResponseData | null;
  availableModels: Array<{ modelId: number; modelName: string }>;
};

type ChapterRawModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: number;
  modelId?: number;
};

type CanonicalTabType = "processed" | "sourceJson";
type LlmTabType = "processed" | "sourceJson";

// ============================================================================
// Copy Button Component
// ============================================================================

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={cn("h-7 gap-1.5 text-xs", className)}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </Button>
  );
}

// ============================================================================
// Tab Button Component
// ============================================================================

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Text Panel Component
// ============================================================================

function TextPanel({
  title,
  text,
  isJson = false,
}: {
  title: string;
  text: string;
  isJson?: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <CopyButton text={text} />
      </div>
      <ScrollArea className="flex-1 rounded-md border border-border bg-muted/30">
        <pre
          className={cn(
            "p-3 text-sm whitespace-pre-wrap break-words",
            isJson && "font-mono text-xs"
          )}
        >
          {text}
        </pre>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Diff Panel Component
// ============================================================================

function DiffPanel({ canonical, llm }: { canonical: string; llm: string }) {
  const changes = useMemo(() => diffWords(canonical, llm), [canonical, llm]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Canonical
        </div>
        <p className="text-sm leading-relaxed">
          {changes.map((change, idx) => {
            if ((change as { added?: boolean }).added) return null;
            if ((change as { removed?: boolean }).removed) {
              return (
                <span
                  key={idx}
                  className="bg-red-500/20 text-red-700 dark:text-red-300 px-0.5 rounded"
                >
                  {change.value}
                </span>
              );
            }
            return <span key={idx}>{change.value}</span>;
          })}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          LLM Output
        </div>
        <p className="text-sm leading-relaxed">
          {changes.map((change, idx) => {
            if ((change as { removed?: boolean }).removed) return null;
            if ((change as { added?: boolean }).added) {
              return (
                <span
                  key={idx}
                  className="bg-green-500/20 text-green-700 dark:text-green-300 px-0.5 rounded"
                >
                  {change.value}
                </span>
              );
            }
            return <span key={idx}>{change.value}</span>;
          })}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function ChapterRawModal({
  open,
  onOpenChange,
  chapterId,
  modelId,
}: ChapterRawModalProps) {
  const [data, setData] = useState<ChapterRawData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canonicalTab, setCanonicalTab] = useState<CanonicalTabType>("processed");
  const [llmTab, setLlmTab] = useState<LlmTabType>("processed");
  const [showDiff, setShowDiff] = useState(false);

  // Fetch data when modal opens
  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ chapterId: String(chapterId) });
        if (modelId !== undefined) {
          params.set("modelId", String(modelId));
        }

        const res = await fetch(`/api/admin/explorer/chapter-raw?${params}`);
        const json = await res.json();

        if (!json.ok) {
          throw new Error(json.error ?? "Failed to fetch chapter data");
        }

        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [open, chapterId, modelId]);

  // Get canonical text based on selected tab
  const getCanonicalText = () => {
    if (!data) return "";
    switch (canonicalTab) {
      case "processed":
        return data.canonical.textProcessed;
      case "sourceJson":
        return JSON.stringify(data.canonical.sourceJson, null, 2);
    }
  };

  // Get LLM text based on selected tab
  const getLlmText = () => {
    if (!data?.llmResponse) return "No LLM response available";
    switch (llmTab) {
      case "processed":
        return data.llmResponse.extractedText ?? "No extracted text";
      case "sourceJson":
        return data.llmResponse.responseRaw;
    }
  };

  const diffActive = showDiff && canonicalTab === "processed" && llmTab === "processed";

  const handleToggleDiff = () => {
    if (canonicalTab !== "processed") {
      setCanonicalTab("processed");
    }
    if (llmTab !== "processed") {
      setLlmTab("processed");
    }
    setShowDiff((prev) => !prev);
  };

  useEffect(() => {
    if (showDiff && (canonicalTab !== "processed" || llmTab !== "processed")) {
      setShowDiff(false);
    }
  }, [showDiff, canonicalTab, llmTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowsLeftRight className="h-5 w-5" />
            Raw Chapter Comparison
            {data && (
              <span className="text-muted-foreground font-normal">
                - {data.reference}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Loading chapter data...
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center text-red-500">
            Error: {error}
          </div>
        )}

        {data && !loading && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Metadata Row */}
            {data.llmResponse && (
              <div className="shrink-0 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-b border-border pb-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Model:</span>
                    <span className="text-foreground">
                      {data.llmResponse.modelName}
                    </span>
                  </div>
                  {data.llmResponse.latencyMs && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{data.llmResponse.latencyMs}ms</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleDiff}
                    className="gap-2"
                  >
                    {showDiff ? "Hide Diff" : "Show Diff"}
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="font-medium">Evaluated:</span>
                  <span>
                    {new Date(data.llmResponse.evaluatedAt).toLocaleString()}
                  </span>
                </div>

                {data.llmResponse.parseError && (
                  <div className="text-amber-500">
                    Parse Error: {data.llmResponse.parseError}
                  </div>
                )}
              </div>
            )}

            {/* Prompts Section (Collapsible) */}
            {data.llmResponse?.systemPrompt && (
              <details className="shrink-0 border border-border rounded-md">
                <summary className="px-3 py-2 text-xs font-medium cursor-pointer hover:bg-muted/50">
                  View Prompts
                </summary>
                <div className="p-3 border-t border-border space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        System Prompt
                      </span>
                      <CopyButton text={data.llmResponse.systemPrompt} />
                    </div>
                    <pre className="text-xs bg-muted/30 p-2 rounded-md whitespace-pre-wrap">
                      {data.llmResponse.systemPrompt}
                    </pre>
                  </div>
                  {data.llmResponse.userPrompt && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          User Prompt
                        </span>
                        <CopyButton text={data.llmResponse.userPrompt} />
                      </div>
                      <pre className="text-xs bg-muted/30 p-2 rounded-md whitespace-pre-wrap">
                        {data.llmResponse.userPrompt}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Two-Column Comparison */}
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
              {/* Canonical Column */}
              <div className="flex flex-col min-h-0">
                <div className="shrink-0 flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">
                      Canonical (ABS Source)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                    <TabButton
                      active={canonicalTab === "processed"}
                      onClick={() => setCanonicalTab("processed")}
                    >
                      Processed
                    </TabButton>
                    <TabButton
                      active={canonicalTab === "sourceJson"}
                      onClick={() => setCanonicalTab("sourceJson")}
                    >
                      Source JSON
                    </TabButton>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  {!diffActive && (
                    <TextPanel
                      title={
                        canonicalTab === "processed"
                          ? "Processed Text (after transforms)"
                          : "Source JSON (ABS API Payload)"
                      }
                      text={getCanonicalText()}
                      isJson={canonicalTab === "sourceJson"}
                    />
                  )}
                </div>
              </div>

              {/* LLM Column */}
              <div className="flex flex-col min-h-0">
                <div className="shrink-0 flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      LLM Response
                      {data.llmResponse && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({data.llmResponse.modelName})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                    <TabButton
                      active={llmTab === "processed"}
                      onClick={() => setLlmTab("processed")}
                    >
                      Processed
                    </TabButton>
                    <TabButton
                      active={llmTab === "sourceJson"}
                      onClick={() => setLlmTab("sourceJson")}
                    >
                      Source JSON
                    </TabButton>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  {!diffActive && (
                    <TextPanel
                      title={
                        llmTab === "processed"
                          ? "Processed Text (parsed from response)"
                          : "Source JSON (from model)"
                      }
                      text={getLlmText()}
                      isJson={llmTab === "sourceJson"}
                    />
                  )}
                </div>
              </div>

              {diffActive && (
                <div className="col-span-2">
                  <DiffPanel
                    canonical={data.canonical.textProcessed}
                    llm={data.llmResponse?.extractedText ?? ""}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type { ChapterRawData, ChapterRawModalProps };
