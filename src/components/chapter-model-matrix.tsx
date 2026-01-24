"use client";

import { useMemo } from "react";
import { CheckCircle, Warning, XCircle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type ScoreThresholds = {
  pass: number;
  warning: number;
  fail: number;
};

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  pass: 100,
  warning: 95,
  fail: 94,
};

type ChapterItem = {
  chapterId: number;
  chapterNumber: number;
  modelId: number;
  modelName: string;
  avgFidelity: number;
  perfectRate: number;
  verseCount: number;
  matchCount: number;
  evaluatedAt: string;
};

type ModelColumn = {
  modelId: number;
  modelName: string;
};

type ChapterRow = {
  chapterId: number;
  chapterNumber: number;
  verseCount: number;
  scores: Map<number, { avgFidelity: number; matchCount: number; perfectRate: number }>;
};

type ChapterModelMatrixProps = {
  items: ChapterItem[];
  onCellClick?: (chapterId: number, modelId: number) => void;
  thresholds?: ScoreThresholds;
};

// ============================================================================
// Score Visualization Helpers
// ============================================================================

function getScoreColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
  if (score >= thresholds.pass) return "text-green-600 dark:text-green-400";
  if (score >= thresholds.warning) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBgColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
  if (score >= thresholds.pass) return "bg-green-500/20";
  if (score >= thresholds.warning) return "bg-yellow-500/20";
  return "bg-red-500/20";
}

function ScoreIcon({ score, thresholds = DEFAULT_THRESHOLDS }: { score: number; thresholds?: ScoreThresholds }) {
  if (score >= thresholds.pass) return <CheckCircle className="h-3 w-3 text-green-500" weight="fill" />;
  if (score >= thresholds.warning) return <Warning className="h-3 w-3 text-yellow-500" weight="fill" />;
  return <XCircle className="h-3 w-3 text-red-500" weight="fill" />;
}

// ============================================================================
// Matrix Cell Component
// ============================================================================

type MatrixCellProps = {
  score: number | null;
  matchCount: number;
  verseCount: number;
  thresholds: ScoreThresholds;
  onClick?: () => void;
};

function MatrixCell({ score, matchCount, verseCount, thresholds, onClick }: MatrixCellProps) {
  if (score === null) {
    return (
      <td className="px-2 py-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-10 rounded bg-muted/50 text-xs text-muted-foreground">
          N/A
        </div>
      </td>
    );
  }

  return (
    <td className="px-2 py-2 text-center">
      <button
        onClick={onClick}
        className={cn(
          "inline-flex flex-col items-center justify-center w-16 h-12 rounded transition-all",
          "hover:ring-2 hover:ring-primary hover:ring-offset-1 hover:ring-offset-background",
          getScoreBgColor(score, thresholds)
        )}
        title={`${matchCount}/${verseCount} verses match (${(matchCount / verseCount * 100).toFixed(1)}%)`}
      >
        <div className="flex items-center gap-1">
          <span className={cn("text-sm font-bold", getScoreColor(score, thresholds))}>
            {score.toFixed(1)}
          </span>
          <ScoreIcon score={score} thresholds={thresholds} />
        </div>
        <span className="text-[9px] text-muted-foreground">
          {matchCount}/{verseCount}
        </span>
      </button>
    </td>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChapterModelMatrix({
  items,
  onCellClick,
  thresholds = DEFAULT_THRESHOLDS,
}: ChapterModelMatrixProps) {
  // Extract unique models for columns
  const models: ModelColumn[] = useMemo(() => {
    const modelMap = new Map<number, string>();
    items.forEach((item) => {
      if (!modelMap.has(item.modelId)) {
        modelMap.set(item.modelId, item.modelName);
      }
    });
    return Array.from(modelMap.entries())
      .map(([modelId, modelName]) => ({ modelId, modelName }))
      .sort((a, b) => a.modelName.localeCompare(b.modelName));
  }, [items]);

  // Group items by chapter and create rows
  const rows: ChapterRow[] = useMemo(() => {
    const chapterMap = new Map<number, ChapterRow>();

    items.forEach((item) => {
      if (!chapterMap.has(item.chapterId)) {
        chapterMap.set(item.chapterId, {
          chapterId: item.chapterId,
          chapterNumber: item.chapterNumber,
          verseCount: item.verseCount,
          scores: new Map(),
        });
      }

      const row = chapterMap.get(item.chapterId)!;
      row.scores.set(item.modelId, {
        avgFidelity: item.avgFidelity,
        matchCount: item.matchCount,
        perfectRate: item.perfectRate,
      });
    });

    return Array.from(chapterMap.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
  }, [items]);

  // Compute column averages
  const columnAverages = useMemo(() => {
    const averages = new Map<number, number>();
    models.forEach((model) => {
      const scores = rows
        .map((row) => row.scores.get(model.modelId)?.avgFidelity)
        .filter((s): s is number => s !== undefined);
      if (scores.length > 0) {
        averages.set(model.modelId, scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    });
    return averages;
  }, [rows, models]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">No chapter data available for matrix view.</p>
      </div>
    );
  }

  if (models.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Matrix view requires at least 2 models. Currently showing {models.length} model(s).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          {/* Header */}
          <thead className="bg-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[140px]">
                Chapter
              </th>
              {models.map((model) => (
                <th
                  key={model.modelId}
                  className="px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-[80px]"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="truncate max-w-[100px]" title={model.modelName}>
                      {model.modelName.length > 12 
                        ? model.modelName.substring(0, 12) + "..." 
                        : model.modelName}
                    </span>
                    {columnAverages.has(model.modelId) && (
                      <span className={cn(
                        "text-[10px] font-normal",
                        getScoreColor(columnAverages.get(model.modelId)!, thresholds)
                      )}>
                        avg: {columnAverages.get(model.modelId)!.toFixed(1)}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-border bg-card">
            {rows.map((row) => (
              <tr key={row.chapterId} className="hover:bg-accent/5">
                <td className="sticky left-0 z-10 bg-card px-4 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-muted text-xs font-bold">
                      {row.chapterNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({row.verseCount}v)
                    </span>
                  </div>
                </td>
                {models.map((model) => {
                  const score = row.scores.get(model.modelId);
                  return (
                    <MatrixCell
                      key={model.modelId}
                      score={score?.avgFidelity ?? null}
                      matchCount={score?.matchCount ?? 0}
                      verseCount={row.verseCount}
                      thresholds={thresholds}
                      onClick={
                        score && onCellClick
                          ? () => onCellClick(row.chapterId, model.modelId)
                          : undefined
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>

          {/* Footer with totals */}
          <tfoot className="bg-muted/50">
            <tr>
              <td className="sticky left-0 z-10 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                Totals ({rows.length} chapters)
              </td>
              {models.map((model) => {
                const totalVerses = rows.reduce((sum, row) => {
                  const score = row.scores.get(model.modelId);
                  return sum + (score ? row.verseCount : 0);
                }, 0);
                const totalMatches = rows.reduce((sum, row) => {
                  const score = row.scores.get(model.modelId);
                  return sum + (score?.matchCount ?? 0);
                }, 0);
                const avgFidelity = columnAverages.get(model.modelId);

                return (
                  <td key={model.modelId} className="px-2 py-2 text-center">
                    {avgFidelity !== undefined ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn("text-sm font-bold", getScoreColor(avgFidelity, thresholds))}>
                          {avgFidelity.toFixed(1)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {totalMatches}/{totalVerses}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-4 px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <span>Click cell to drill into verse comparison</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Pass ({thresholds.pass}+)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
          Warning ({thresholds.warning}-{thresholds.pass - 0.1})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          Fail (&lt;{thresholds.warning})
        </span>
      </div>
    </div>
  );
}
