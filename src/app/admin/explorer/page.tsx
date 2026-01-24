"use client";

import { Suspense, useCallback, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MagnifyingGlass,
  CaretRight,
  House,
  CheckCircle,
  Warning,
  XCircle,
  ArrowLeft,
  Funnel,
  Eye,
  EyeSlash,
  ArrowsLeftRight,
  GridFour,
  Table,
} from "@phosphor-icons/react";
import { diffWords, type Change } from "diff";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TransformFilterPanel } from "@/components/transform-filter-panel";
import { ChapterModelMatrix } from "@/components/chapter-model-matrix";
import {
  type TransformStep,
  applyTransformsAndScore,
} from "@/lib/client-transforms";

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

type ExplorerLevel = "campaign" | "bible" | "book" | "chapter" | "verse";

type BreadcrumbItem = {
  level: ExplorerLevel;
  id: string | number | null;
  label: string;
};

type SummaryStats = {
  totalVerses: number;
  matchCount: number;
  avgFidelity: number;
  perfectRate: number;
  modelCount: number;
  lastEvaluated: string | null;
};

type ModelOption = {
  modelId: number;
  displayName: string;
  provider: string;
};

type Campaign = {
  campaignId: number;
  campaignTag: string;
  campaignName: string;
  campaignDescription: string | null;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  isActive: boolean;
  isApproved: boolean;
};

type BibleItem = {
  bibleId: number;
  bibleName: string;
  modelId: number;
  modelName: string;
  avgFidelity: number;
  perfectRate: number;
  bookCount: number;
  chapterCount: number;
  verseCount: number;
  matchCount: number;
  evaluatedAt: string;
};

type BookItem = {
  bookId: number;
  bookName: string;
  bookIndex: number;
  modelId: number;
  modelName: string;
  avgFidelity: number;
  perfectRate: number;
  chapterCount: number;
  verseCount: number;
  matchCount: number;
  evaluatedAt: string;
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

type VerseItem = {
  verseId: number;
  verseNumber: number;
  reference: string;
  modelId: number;
  modelName: string;
  canonicalText: string;
  llmText: string;
  hashMatch: boolean;
  fidelityScore: number;
  diff: { substitutions: number; omissions: number; additions: number };
  latencyMs: number;
  evaluatedAt: string;
};

type ExplorerData = {
  level: ExplorerLevel;
  campaignTag?: string;
  campaignName?: string;
  bibleId?: number;
  bibleName?: string;
  bookId?: number;
  bookName?: string;
  chapterId?: number;
  chapterNumber?: number;
  campaigns?: Campaign[];
  items?: BibleItem[] | BookItem[] | ChapterItem[] | VerseItem[];
  breadcrumb: BreadcrumbItem[];
  summary: SummaryStats | null;
  models: ModelOption[];
  selectedModelId?: number | null;
  thresholds?: ScoreThresholds;
};

// ============================================================================
// Score Visualization Components
// ============================================================================

function getScoreColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
  if (score >= thresholds.pass) return "text-green-600 dark:text-green-400";
  if (score >= thresholds.warning) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreBgColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
  if (score >= thresholds.pass) return "bg-green-500/10";
  if (score >= thresholds.warning) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function getScoreBorderColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
  if (score >= thresholds.pass) return "border-green-500/30";
  if (score >= thresholds.warning) return "border-yellow-500/30";
  return "border-red-500/30";
}

function ScoreIcon({ score, thresholds = DEFAULT_THRESHOLDS }: { score: number; thresholds?: ScoreThresholds }) {
  if (score >= thresholds.pass) return <CheckCircle className="h-5 w-5 text-green-500" weight="fill" />;
  if (score >= thresholds.warning) return <Warning className="h-5 w-5 text-yellow-500" weight="fill" />;
  return <XCircle className="h-5 w-5 text-red-500" weight="fill" />;
}

function FidelityGauge({ score, size = "md", thresholds = DEFAULT_THRESHOLDS }: { score: number; size?: "sm" | "md" | "lg"; thresholds?: ScoreThresholds }) {
  const sizes = {
    sm: { container: "h-12 w-12", text: "text-xs", ring: 36, stroke: 4 },
    md: { container: "h-20 w-20", text: "text-lg", ring: 64, stroke: 6 },
    lg: { container: "h-28 w-28", text: "text-2xl", ring: 96, stroke: 8 },
  };
  const s = sizes[size];
  const radius = (s.ring - s.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getStrokeColor = (score: number, t: ScoreThresholds) => {
    if (score >= t.pass) return "stroke-green-500";
    if (score >= t.warning) return "stroke-yellow-500";
    return "stroke-red-500";
  };

  return (
    <div className={cn("relative flex items-center justify-center", s.container)}>
      <svg className="absolute -rotate-90" width={s.ring} height={s.ring}>
        <circle
          cx={s.ring / 2}
          cy={s.ring / 2}
          r={radius}
          fill="none"
          strokeWidth={s.stroke}
          className="stroke-muted"
        />
        <circle
          cx={s.ring / 2}
          cy={s.ring / 2}
          r={radius}
          fill="none"
          strokeWidth={s.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className={cn("transition-all duration-500", getStrokeColor(score, thresholds))}
        />
      </svg>
      <span className={cn("font-bold", s.text, getScoreColor(score, thresholds))}>
        {Math.round(score)}
      </span>
    </div>
  );
}

function PerfectRateRing({ rate, matchCount, totalCount, size = "md", thresholds = DEFAULT_THRESHOLDS }: { 
  rate: number; 
  matchCount: number;
  totalCount: number;
  size?: "sm" | "md";
  thresholds?: ScoreThresholds;
}) {
  const percentage = rate * 100;
  const sizes = {
    sm: { container: "h-14 w-14", text: "text-[10px]", ring: 48, stroke: 4 },
    md: { container: "h-20 w-20", text: "text-xs", ring: 72, stroke: 6 },
  };
  const s = sizes[size];
  const radius = (s.ring - s.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = rate * circumference;

  // Use threshold-based colors for consistency
  const getStrokeColor = (pct: number, t: ScoreThresholds) => {
    if (pct >= t.pass) return "stroke-green-500";
    if (pct >= t.warning) return "stroke-yellow-500";
    return "stroke-red-500";
  };

  return (
    <div className={cn("relative flex flex-col items-center justify-center", s.container)}>
      <svg className="absolute -rotate-90" width={s.ring} height={s.ring}>
        <circle
          cx={s.ring / 2}
          cy={s.ring / 2}
          r={radius}
          fill="none"
          strokeWidth={s.stroke}
          className="stroke-muted"
        />
        <circle
          cx={s.ring / 2}
          cy={s.ring / 2}
          r={radius}
          fill="none"
          strokeWidth={s.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className={cn("transition-all duration-500", getStrokeColor(percentage, thresholds))}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className={cn("font-bold", s.text, getScoreColor(percentage, thresholds))}>
          {percentage.toFixed(1)}%
        </span>
        <span className="text-[8px] text-muted-foreground">
          {matchCount}/{totalCount}
        </span>
      </div>
    </div>
  );
}

function ScoreBadge({ score, showLabel = true, thresholds = DEFAULT_THRESHOLDS }: { score: number; showLabel?: boolean; thresholds?: ScoreThresholds }) {
  const getLabel = (score: number, t: ScoreThresholds) => {
    if (score >= t.pass) return "Pass";
    if (score >= t.warning) return "Warning";
    return "Fail";
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border",
        getScoreBgColor(score, thresholds),
        getScoreBorderColor(score, thresholds),
        getScoreColor(score, thresholds)
      )}
    >
      <ScoreIcon score={score} thresholds={thresholds} />
      {showLabel && <span>{getLabel(score, thresholds)}</span>}
      <span className="font-bold">{score.toFixed(1)}</span>
    </div>
  );
}

function FidelityBar({ score, thresholds = DEFAULT_THRESHOLDS }: { score: number; thresholds?: ScoreThresholds }) {
  const getBarColor = (score: number, t: ScoreThresholds) => {
    if (score >= t.pass) return "bg-green-500";
    if (score >= t.warning) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            getBarColor(score, thresholds)
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("text-sm font-medium", getScoreColor(score, thresholds))}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

// ============================================================================
// Breadcrumb Navigation
// ============================================================================

function Breadcrumb({ 
  items, 
  onNavigate 
}: { 
  items: BreadcrumbItem[]; 
  onNavigate: (level: ExplorerLevel, id: string | number | null) => void;
}) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onNavigate("campaign", null)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <House className="h-4 w-4" />
        <span>Campaigns</span>
      </button>
      {items.map((item, idx) => (
        <div key={`${item.level}-${item.id}`} className="flex items-center gap-1">
          <CaretRight className="h-3 w-3 text-muted-foreground" />
          <button
            onClick={() => onNavigate(item.level, item.id)}
            className={cn(
              "transition-colors",
              idx === items.length - 1
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        </div>
      ))}
    </nav>
  );
}

// ============================================================================
// Model Selector
// ============================================================================

function ModelSelector({
  models,
  selectedModelId,
  onSelect,
}: {
  models: ModelOption[];
  selectedModelId: number | null;
  onSelect: (modelId: number | null) => void;
}) {
  if (models.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Funnel className="h-4 w-4 text-muted-foreground" />
      <select
        value={selectedModelId ?? ""}
        onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All Models</option>
        {models.map((m) => (
          <option key={m.modelId} value={m.modelId}>
            {m.displayName} ({m.provider})
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// Summary Stats Header
// ============================================================================

function SummaryHeader({
  campaignName,
  summary,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  campaignName: string;
  summary: SummaryStats;
  thresholds?: ScoreThresholds;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{campaignName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.totalVerses.toLocaleString()} verses evaluated across{" "}
            {summary.modelCount} model{summary.modelCount !== 1 ? "s" : ""}
          </p>
          {summary.lastEvaluated && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Last evaluated: {new Date(summary.lastEvaluated).toLocaleString()}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">Fidelity</span>
            <FidelityGauge score={summary.avgFidelity} size="md" thresholds={thresholds} />
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">Perfect Match</span>
            <PerfectRateRing 
              rate={summary.perfectRate} 
              matchCount={summary.matchCount}
              totalCount={summary.totalVerses}
              size="md"
              thresholds={thresholds}
            />
          </div>
          
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Matches:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {summary.matchCount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Mismatches:</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {(summary.totalVerses - summary.matchCount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Campaign Selection View
// ============================================================================

function CampaignSelector({
  campaigns,
  onSelect,
}: {
  campaigns: Campaign[];
  onSelect: (campaignTag: string) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted p-8 text-center">
        <MagnifyingGlass className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No Campaigns Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a campaign and run model evaluations to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <button
          key={campaign.campaignId}
          onClick={() => onSelect(campaign.campaignTag)}
          className="group rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-foreground group-hover:text-primary">
                {campaign.campaignName}
              </h3>
              <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {campaign.campaignTag}
              </code>
            </div>
            <div className="flex gap-1">
              {campaign.isActive && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  Active
                </span>
              )}
              {campaign.isApproved && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                  Approved
                </span>
              )}
            </div>
          </div>
          {campaign.campaignDescription && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {campaign.campaignDescription}
            </p>
          )}
          {campaign.campaignStartDate && (
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(campaign.campaignStartDate).toLocaleDateString()}
              {campaign.campaignEndDate && (
                <> - {new Date(campaign.campaignEndDate).toLocaleDateString()}</>
              )}
            </p>
          )}
          <div className="mt-3 flex items-center text-sm text-primary">
            <span>Explore</span>
            <CaretRight className="ml-1 h-4 w-4" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Bible Grid View
// ============================================================================

function BibleGrid({
  items,
  onSelect,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  items: BibleItem[];
  onSelect: (bibleId: number) => void;
  thresholds?: ScoreThresholds;
}) {
  // Group by bible if multiple models
  const groupedByBible = useMemo(() => {
    const map = new Map<number, BibleItem[]>();
    items.forEach((item) => {
      const existing = map.get(item.bibleId) ?? [];
      existing.push(item);
      map.set(item.bibleId, existing);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groupedByBible.map(([bibleId, bibleItems]) => {
        const first = bibleItems[0];
        const avgFidelity = bibleItems.reduce((s, i) => s + i.avgFidelity, 0) / bibleItems.length;
        const totalVerses = bibleItems.reduce((s, i) => s + i.verseCount, 0);
        const totalMatches = bibleItems.reduce((s, i) => s + i.matchCount, 0);

        return (
          <button
            key={bibleId}
            onClick={() => onSelect(bibleId)}
            className={cn(
              "group rounded-lg border bg-card p-4 text-left transition-all hover:shadow-md",
              getScoreBorderColor(avgFidelity, thresholds),
              "hover:border-primary"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-foreground group-hover:text-primary">
                  {first.bibleName}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{first.bookCount} books</span>
                  <span>•</span>
                  <span>{first.chapterCount} chapters</span>
                </div>
              </div>
              <FidelityGauge score={avgFidelity} size="sm" thresholds={thresholds} />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <FidelityBar score={avgFidelity} thresholds={thresholds} />
              <div className="text-right text-xs">
                <div className="text-muted-foreground">
                  {totalMatches.toLocaleString()}/{totalVerses.toLocaleString()}
                </div>
                <div className={cn("font-medium", getScoreColor(avgFidelity, thresholds))}>
                  {((totalMatches / totalVerses) * 100).toFixed(1)}% match
                </div>
              </div>
            </div>

            {bibleItems.length > 1 && (
              <div className="mt-3 text-xs text-muted-foreground">
                {bibleItems.length} models evaluated
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Book List View
// ============================================================================

function BookList({
  items,
  onSelect,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  items: BookItem[];
  onSelect: (bookId: number) => void;
  thresholds?: ScoreThresholds;
}) {
  // Group by book
  const groupedByBook = useMemo(() => {
    const map = new Map<number, BookItem[]>();
    items.forEach((item) => {
      const existing = map.get(item.bookId) ?? [];
      existing.push(item);
      map.set(item.bookId, existing);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const aIndex = a[1][0]?.bookIndex ?? 0;
      const bIndex = b[1][0]?.bookIndex ?? 0;
      return aIndex - bIndex;
    });
  }, [items]);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Book
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fidelity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Match Rate
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Chapters
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Verses
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {groupedByBook.map(([bookId, bookItems]) => {
            const first = bookItems[0];
            const avgFidelity = bookItems.reduce((s, i) => s + i.avgFidelity, 0) / bookItems.length;
            const totalVerses = bookItems.reduce((s, i) => s + i.verseCount, 0);
            const totalMatches = bookItems.reduce((s, i) => s + i.matchCount, 0);
            const matchRate = (totalMatches / totalVerses) * 100;

            return (
              <tr
                key={bookId}
                onClick={() => onSelect(bookId)}
                className="cursor-pointer hover:bg-accent/10 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ScoreIcon score={avgFidelity} thresholds={thresholds} />
                    <span className="font-medium text-foreground">{first.bookName}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <FidelityBar score={avgFidelity} thresholds={thresholds} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${matchRate}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {matchRate.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {first.chapterCount}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {totalVerses.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <ScoreBadge score={avgFidelity} showLabel={false} thresholds={thresholds} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Chapter Grid View
// ============================================================================

type ScoreFilterCategory = "all" | "pass" | "warning" | "fail";

function ChapterGrid({
  items,
  onSelect,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  items: ChapterItem[];
  onSelect: (chapterId: number) => void;
  thresholds?: ScoreThresholds;
}) {
  const [categoryFilter, setCategoryFilter] = useState<ScoreFilterCategory>("all");
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);

  // Group by chapter
  const groupedByChapter = useMemo(() => {
    const map = new Map<number, ChapterItem[]>();
    items.forEach((item) => {
      const existing = map.get(item.chapterId) ?? [];
      existing.push(item);
      map.set(item.chapterId, existing);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const aNum = a[1][0]?.chapterNumber ?? 0;
      const bNum = b[1][0]?.chapterNumber ?? 0;
      return aNum - bNum;
    });
  }, [items]);

  // Apply filters
  const filteredChapters = useMemo(() => {
    return groupedByChapter.filter(([, chapterItems]) => {
      const avgFidelity = chapterItems.reduce((s, i) => s + i.avgFidelity, 0) / chapterItems.length;

      // Score range filter
      if (avgFidelity < scoreRange[0] || avgFidelity > scoreRange[1]) return false;

      // Category filter
      if (categoryFilter === "pass" && avgFidelity < thresholds.pass) return false;
      if (categoryFilter === "warning" && (avgFidelity >= thresholds.pass || avgFidelity < thresholds.warning)) return false;
      if (categoryFilter === "fail" && avgFidelity >= thresholds.warning) return false;

      return true;
    });
  }, [groupedByChapter, categoryFilter, scoreRange, thresholds]);

  // Count by category for filter buttons
  const categoryCounts = useMemo(() => {
    let pass = 0, warning = 0, fail = 0;
    for (const [, chapterItems] of groupedByChapter) {
      const avgFidelity = chapterItems.reduce((s, i) => s + i.avgFidelity, 0) / chapterItems.length;
      if (avgFidelity >= thresholds.pass) pass++;
      else if (avgFidelity >= thresholds.warning) warning++;
      else fail++;
    }
    return { all: groupedByChapter.length, pass, warning, fail };
  }, [groupedByChapter, thresholds]);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Funnel className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({categoryCounts.all})
            </button>
            <button
              onClick={() => setCategoryFilter("pass")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                categoryFilter === "pass"
                  ? "bg-green-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pass ({categoryCounts.pass})
            </button>
            <button
              onClick={() => setCategoryFilter("warning")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                categoryFilter === "warning"
                  ? "bg-yellow-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Warning ({categoryCounts.warning})
            </button>
            <button
              onClick={() => setCategoryFilter("fail")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                categoryFilter === "fail"
                  ? "bg-red-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Fail ({categoryCounts.fail})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Score:</span>
          <input
            type="number"
            min={0}
            max={100}
            value={scoreRange[0]}
            onChange={(e) => setScoreRange([Number(e.target.value), scoreRange[1]])}
            className="w-14 rounded border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={scoreRange[0]}
            onChange={(e) => setScoreRange([Number(e.target.value), scoreRange[1]])}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <input
            type="range"
            min={0}
            max={100}
            value={scoreRange[1]}
            onChange={(e) => setScoreRange([scoreRange[0], Number(e.target.value)])}
            className="w-24"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={scoreRange[1]}
            onChange={(e) => setScoreRange([scoreRange[0], Number(e.target.value)])}
            className="w-14 rounded border border-input bg-background px-2 py-1 text-xs"
          />
          <span className="text-xs text-muted-foreground">
            Showing: {filteredChapters.length}/{groupedByChapter.length}
          </span>
        </div>
      </div>

      {/* Chapter Grid */}
      <div className="grid gap-3 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {filteredChapters.map(([chapterId, chapterItems]) => {
          const first = chapterItems[0];
          const avgFidelity = chapterItems.reduce((s, i) => s + i.avgFidelity, 0) / chapterItems.length;
          const totalVerses = chapterItems.reduce((s, i) => s + i.verseCount, 0);
          const totalMatches = chapterItems.reduce((s, i) => s + i.matchCount, 0);
          const matchRate = (totalMatches / totalVerses) * 100;

          return (
            <button
              key={chapterId}
              onClick={() => onSelect(chapterId)}
              className={cn(
                "group relative flex flex-col items-center justify-center rounded-lg border p-3 transition-all hover:shadow-md",
                getScoreBgColor(avgFidelity, thresholds),
                getScoreBorderColor(avgFidelity, thresholds),
                "hover:border-primary"
              )}
            >
              <span className="text-lg font-bold text-foreground">
                {first.chapterNumber}
              </span>
              <span className={cn("text-xs font-medium", getScoreColor(avgFidelity, thresholds))}>
                {avgFidelity.toFixed(0)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {totalVerses}v
              </span>
              
              {/* Mini match indicator */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${matchRate}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {filteredChapters.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No chapters match the current filter criteria.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Verse Comparison View
// ============================================================================

function WordDiff({ canonical, llm }: { canonical: string; llm: string }) {
  const changes = useMemo(() => diffWords(canonical, llm), [canonical, llm]);

  return (
    <div className="flex gap-4">
      {/* Canonical side */}
      <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Canonical
        </div>
        <p className="text-sm leading-relaxed">
          {changes.map((change: Change, idx: number) => {
            if (change.added) return null;
            if (change.removed) {
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

      {/* LLM side */}
      <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          LLM Output
        </div>
        <p className="text-sm leading-relaxed">
          {changes.map((change: Change, idx: number) => {
            if (change.removed) return null;
            if (change.added) {
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

type NormalizedVerseItem = VerseItem & {
  normalizedScore: number | null;
  normalizedHashMatch: boolean | null;
  normalizedDiff: { substitutions: number; omissions: number; additions: number } | null;
};

function VerseComparisonView({
  items,
  chapterNumber,
}: {
  items: VerseItem[];
  chapterNumber: number;
}) {
  const [filter, setFilter] = useState<"all" | "matches" | "mismatches">("all");
  const [showDiff, setShowDiff] = useState(true);
  const [selectedTransforms, setSelectedTransforms] = useState<TransformStep[]>([]);
  const [useNormalizedScores, setUseNormalizedScores] = useState(false);

  // Handle transform changes from the filter panel
  const handleTransformsChange = useCallback((transforms: TransformStep[]) => {
    setSelectedTransforms(transforms);
    setUseNormalizedScores(transforms.length > 0);
  }, []);

  // Compute normalized scores when transforms are selected
  const normalizedItems: NormalizedVerseItem[] = useMemo(() => {
    if (selectedTransforms.length === 0) {
      return items.map((item) => ({
        ...item,
        normalizedScore: null,
        normalizedHashMatch: null,
        normalizedDiff: null,
      }));
    }

    return items.map((item) => {
      const result = applyTransformsAndScore(
        item.llmText,
        item.canonicalText,
        selectedTransforms
      );
      return {
        ...item,
        normalizedScore: result.fidelityScore,
        normalizedHashMatch: result.fidelityScore >= 100,
        normalizedDiff: {
          substitutions: result.diff.substitutions,
          omissions: result.diff.omissions,
          additions: result.diff.additions,
        },
      };
    });
  }, [items, selectedTransforms]);

  // Determine which score to use for filtering
  const getEffectiveMatch = useCallback(
    (item: NormalizedVerseItem) => {
      if (useNormalizedScores && item.normalizedHashMatch !== null) {
        return item.normalizedHashMatch;
      }
      return item.hashMatch;
    },
    [useNormalizedScores]
  );

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "matches":
        return normalizedItems.filter((i) => getEffectiveMatch(i));
      case "mismatches":
        return normalizedItems.filter((i) => !getEffectiveMatch(i));
      default:
        return normalizedItems;
    }
  }, [normalizedItems, filter, getEffectiveMatch]);

  const matchCount = normalizedItems.filter((i) => getEffectiveMatch(i)).length;
  const mismatchCount = normalizedItems.length - matchCount;

  return (
    <div className="space-y-4">
      {/* Transform Filter Panel */}
      <TransformFilterPanel
        onTransformsChange={handleTransformsChange}
        className="mb-2"
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Chapter {chapterNumber}</span>
          <span className="text-sm text-muted-foreground">
            ({items.length} verses)
          </span>
          {selectedTransforms.length > 0 && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              Normalized
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter("matches")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filter === "matches"
                  ? "bg-green-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Matches ({matchCount})
            </button>
            <button
              onClick={() => setFilter("mismatches")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filter === "mismatches"
                  ? "bg-amber-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mismatches ({mismatchCount})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDiff(!showDiff)}
            className="gap-2"
          >
            {showDiff ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showDiff ? "Hide Diff" : "Show Diff"}
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-450px)]">
        <div className="space-y-4 pr-4">
          {filteredItems.map((verse) => {
            const effectiveMatch = getEffectiveMatch(verse);
            const showNormalized = verse.normalizedScore !== null;

            return (
              <div
                key={`${verse.verseId}-${verse.modelId}`}
                className={cn(
                  "rounded-lg border p-4 transition-all",
                  effectiveMatch
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted text-sm font-bold">
                      {verse.verseNumber}
                    </span>
                    <span className="text-sm text-muted-foreground">{verse.reference}</span>
                    <span className="text-xs text-muted-foreground">
                      via {verse.modelName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Raw Score */}
                    <div className="flex flex-col items-end gap-0.5">
                      <ScoreBadge score={verse.fidelityScore} showLabel={false} />
                      <span className="text-[10px] text-muted-foreground">Raw</span>
                    </div>
                    {/* Normalized Score (if transforms applied) */}
                    {showNormalized && (
                      <>
                        <ArrowsLeftRight className="h-3 w-3 text-muted-foreground" />
                        <div className="flex flex-col items-end gap-0.5">
                          <ScoreBadge score={verse.normalizedScore!} showLabel={false} />
                          <span className="text-[10px] text-blue-600 dark:text-blue-400">Norm</span>
                        </div>
                      </>
                    )}
                    {effectiveMatch ? (
                      <CheckCircle className="h-5 w-5 text-green-500" weight="fill" />
                    ) : (
                      <Warning className="h-5 w-5 text-amber-500" weight="fill" />
                    )}
                  </div>
                </div>

                {showDiff && !effectiveMatch ? (
                  <WordDiff canonical={verse.canonicalText} llm={verse.llmText} />
                ) : (
                  <div className="flex gap-4">
                    <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Canonical
                      </div>
                      <p className="text-sm leading-relaxed">{verse.canonicalText}</p>
                    </div>
                    <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        LLM Output
                      </div>
                      <p className="text-sm leading-relaxed">{verse.llmText}</p>
                    </div>
                  </div>
                )}

                {!effectiveMatch && (
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    {showNormalized && verse.normalizedDiff ? (
                      <>
                        <span className="text-blue-600 dark:text-blue-400">[Normalized]</span>
                        <span>Substitutions: {verse.normalizedDiff.substitutions}</span>
                        <span>Omissions: {verse.normalizedDiff.omissions}</span>
                        <span>Additions: {verse.normalizedDiff.additions}</span>
                      </>
                    ) : (
                      <>
                        <span>Substitutions: {verse.diff.substitutions}</span>
                        <span>Omissions: {verse.diff.omissions}</span>
                        <span>Additions: {verse.diff.additions}</span>
                      </>
                    )}
                    {verse.latencyMs && <span>Latency: {verse.latencyMs}ms</span>}
                  </div>
                )}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No verses match the current filter.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Loading Fallback
// ============================================================================

function ExplorerLoading() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <MagnifyingGlass className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">LLM Explorer</h1>
      </div>
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Main Explorer Page Content (uses useSearchParams)
// ============================================================================

function ExplorerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterViewMode, setChapterViewMode] = useState<"grid" | "matrix">("grid");

  // Get current params
  const campaignTag = searchParams.get("campaign");
  const modelId = searchParams.get("model");
  const bibleId = searchParams.get("bible");
  const bookId = searchParams.get("book");
  const chapterId = searchParams.get("chapter");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (campaignTag) params.set("campaignTag", campaignTag);
      if (modelId) params.set("modelId", modelId);
      if (bibleId) params.set("bibleId", bibleId);
      if (bookId) params.set("bookId", bookId);
      if (chapterId) params.set("chapterId", chapterId);

      const res = await fetch(`/api/admin/explorer?${params.toString()}`);
      const json = await res.json();

      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.error ?? "Failed to load explorer data.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load explorer data.");
    } finally {
      setLoading(false);
    }
  }, [campaignTag, modelId, bibleId, bookId, chapterId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateTo = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) newParams.set(key, value);
      });
      router.push(`/admin/explorer?${newParams.toString()}`);
    },
    [router]
  );

  const handleBreadcrumbNavigate = useCallback(
    (level: ExplorerLevel, id: string | number | null) => {
      switch (level) {
        case "campaign":
          if (id) {
            navigateTo({ campaign: String(id), model: modelId });
          } else {
            navigateTo({});
          }
          break;
        case "bible":
          navigateTo({ campaign: campaignTag, model: modelId, bible: String(id) });
          break;
        case "book":
          navigateTo({
            campaign: campaignTag,
            model: modelId,
            bible: bibleId,
            book: String(id),
          });
          break;
        case "chapter":
          navigateTo({
            campaign: campaignTag,
            model: modelId,
            bible: bibleId,
            book: bookId,
            chapter: String(id),
          });
          break;
      }
    },
    [navigateTo, campaignTag, modelId, bibleId, bookId]
  );

  const handleModelChange = useCallback(
    (newModelId: number | null) => {
      const params: Record<string, string | null> = {
        campaign: campaignTag,
        model: newModelId ? String(newModelId) : null,
        bible: bibleId,
        book: bookId,
        chapter: chapterId,
      };
      navigateTo(params);
    },
    [navigateTo, campaignTag, bibleId, bookId, chapterId]
  );

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <MagnifyingGlass className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">LLM Explorer</h1>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <MagnifyingGlass className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">LLM Explorer</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <button onClick={fetchData} className="ml-2 underline">
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MagnifyingGlass className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">LLM Explorer</h1>
        </div>

        {data.level !== "campaign" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBreadcrumbNavigate("campaign", null)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            All Campaigns
          </Button>
        )}
      </div>

      {/* Breadcrumb */}
      {data.breadcrumb.length > 0 && (
        <Breadcrumb items={data.breadcrumb} onNavigate={handleBreadcrumbNavigate} />
      )}

      {/* Summary Header (when in a campaign) */}
      {data.summary && data.campaignName && (
        <SummaryHeader campaignName={data.campaignName} summary={data.summary} thresholds={data.thresholds} />
      )}

      {/* Model Selector */}
      {data.models.length > 0 && (
        <div className="flex items-center justify-between">
          <ModelSelector
            models={data.models}
            selectedModelId={data.selectedModelId ?? null}
            onSelect={handleModelChange}
          />
          <span className="text-sm text-muted-foreground">
            {data.items?.length ?? 0} items
          </span>
        </div>
      )}

      {/* Level-specific content */}
      {data.level === "campaign" && data.campaigns && (
        <CampaignSelector
          campaigns={data.campaigns}
          onSelect={(tag) => navigateTo({ campaign: tag })}
        />
      )}

      {data.level === "bible" && data.items && (
        <BibleGrid
          items={data.items as BibleItem[]}
          onSelect={(id) =>
            navigateTo({ campaign: campaignTag, model: modelId, bible: String(id) })
          }
          thresholds={data.thresholds}
        />
      )}

      {data.level === "book" && data.items && (
        <BookList
          items={data.items as BookItem[]}
          onSelect={(id) =>
            navigateTo({
              campaign: campaignTag,
              model: modelId,
              bible: bibleId,
              book: String(id),
            })
          }
          thresholds={data.thresholds}
        />
      )}

      {data.level === "chapter" && data.items && (
        <div className="space-y-4">
          {/* View Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">View:</span>
              <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                <button
                  onClick={() => setChapterViewMode("grid")}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    chapterViewMode === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GridFour className="h-4 w-4" />
                  Grid
                </button>
                <button
                  onClick={() => setChapterViewMode("matrix")}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    chapterViewMode === "matrix"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Table className="h-4 w-4" />
                  Matrix
                </button>
              </div>
            </div>
            {chapterViewMode === "matrix" && (
              <span className="text-xs text-muted-foreground">
                Compare models side-by-side
              </span>
            )}
          </div>

          {/* Grid View */}
          {chapterViewMode === "grid" && (
            <ChapterGrid
              items={data.items as ChapterItem[]}
              onSelect={(id) =>
                navigateTo({
                  campaign: campaignTag,
                  model: modelId,
                  bible: bibleId,
                  book: bookId,
                  chapter: String(id),
                })
              }
              thresholds={data.thresholds}
            />
          )}

          {/* Matrix View */}
          {chapterViewMode === "matrix" && (
            <ChapterModelMatrix
              items={data.items as ChapterItem[]}
              onCellClick={(chId, mId) =>
                navigateTo({
                  campaign: campaignTag,
                  model: String(mId),
                  bible: bibleId,
                  book: bookId,
                  chapter: String(chId),
                })
              }
              thresholds={data.thresholds}
            />
          )}
        </div>
      )}

      {data.level === "verse" && data.items && data.chapterNumber && (
        <VerseComparisonView
          items={data.items as VerseItem[]}
          chapterNumber={data.chapterNumber}
        />
      )}
    </section>
  );
}

// ============================================================================
// Exported Page with Suspense Boundary
// ============================================================================

export default function ExplorerPage() {
  return (
    <Suspense fallback={<ExplorerLoading />}>
      <ExplorerPageContent />
    </Suspense>
  );
}
