/**
 * Client-side transform utilities for interactive re-scoring in the Explorer.
 *
 * These utilities allow users to apply normalization transforms to LLM output
 * and recompute fidelity scores without server round-trips.
 */

import type { TransformStep, TransformSeverity } from "@/lib/transforms";

// Re-export types for convenience
export type { TransformStep, TransformSeverity };

export type DiffSummary = {
  substitutions: number;
  omissions: number;
  additions: number;
  transpositions: number;
};

export type TransformResult = {
  normalizedText: string;
  fidelityScore: number;
  diff: DiffSummary;
};

// Severity ordering for filtering
const SEVERITY_ORDER: Record<TransformSeverity, number> = {
  cosmetic: 1,
  minor: 2,
  significant: 3,
  critical: 4,
};

/**
 * Filter transform steps by maximum severity level.
 * Returns only steps with severity at or below the specified level.
 */
export function filterTransformsBySeverity(
  steps: TransformStep[],
  maxSeverity: TransformSeverity
): TransformStep[] {
  const maxLevel = SEVERITY_ORDER[maxSeverity];
  return steps.filter((step) => {
    if (!step.severity) return true; // Include steps without severity
    return SEVERITY_ORDER[step.severity] <= maxLevel;
  });
}

/**
 * Get severity indicator info for display
 */
export function getSeverityInfo(severity: TransformSeverity | undefined): {
  label: string;
  color: string;
  description: string;
} {
  switch (severity) {
    case "cosmetic":
      return {
        label: "Cosmetic",
        color: "text-green-600 dark:text-green-400",
        description: "No semantic meaning change (apostrophes, quotes, whitespace)",
      };
    case "minor":
      return {
        label: "Minor",
        color: "text-blue-600 dark:text-blue-400",
        description: "Minimal readability impact (punctuation)",
      };
    case "significant":
      return {
        label: "Significant",
        color: "text-yellow-600 dark:text-yellow-400",
        description: "Theological/contextual implications (LORD/Lord)",
      };
    case "critical":
      return {
        label: "Critical",
        color: "text-red-600 dark:text-red-400",
        description: "Doctrinal impact (word substitution)",
      };
    default:
      return {
        label: "Unknown",
        color: "text-muted-foreground",
        description: "No severity specified",
      };
  }
}

// ============================================================================
// Transform Application Logic (mirrors server-side transforms.ts)
// ============================================================================

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const entries = Object.entries(value).filter(([, v]) => typeof v === "string");
  return Object.fromEntries(entries) as Record<string, string>;
}

function stripMarkupTags(input: string, tagNames: string[]): string {
  if (tagNames.length === 0) return input;
  return tagNames.reduce((acc, tag) => {
    const regex = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
    return acc.replaceAll(regex, "");
  }, input);
}

function stripByPatterns(input: string, patterns: string[]): string {
  return patterns.reduce((acc, pattern) => {
    try {
      const regex = new RegExp(pattern, "g");
      return acc.replaceAll(regex, "");
    } catch {
      return acc;
    }
  }, input);
}

function regexReplace(input: string, pattern: string | null, replacement: string): string {
  if (!pattern) return input;
  try {
    const regex = new RegExp(pattern, "g");
    return input.replaceAll(regex, replacement);
  } catch {
    return input;
  }
}

function applyReplaceMap(input: string, map: Record<string, string>): string {
  return Object.entries(map).reduce((acc, [key, value]) => {
    if (!key) return acc;
    return acc.split(key).join(value);
  }, input);
}

/**
 * Apply a list of transform steps to input text.
 * Steps are applied in order, and disabled steps are skipped.
 */
export function applyTransformSteps(input: string, steps: TransformStep[]): string {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  return ordered.reduce((output, step) => {
    if (!step.enabled) return output;

    switch (step.type) {
      case "stripMarkupTags": {
        const tagNames = getStringArray(step.params["tagNames"]);
        return stripMarkupTags(output, tagNames);
      }
      case "stripParagraphMarkers": {
        const markers = getStringArray(step.params["markers"]);
        return markers.reduce((acc, marker) => acc.split(marker).join(""), output);
      }
      case "stripVerseNumbers": {
        const patterns = getStringArray(step.params["patterns"]);
        return stripByPatterns(output, patterns);
      }
      case "stripHeadings": {
        const patterns = getStringArray(step.params["patterns"]);
        return stripByPatterns(output, patterns);
      }
      case "regexReplace": {
        const pattern = getString(step.params["pattern"]);
        const replacement = getString(step.params["replacement"]) ?? "";
        return regexReplace(output, pattern, replacement);
      }
      case "replaceMap": {
        const map = getMap(step.params["map"]);
        return applyReplaceMap(output, map);
      }
      case "collapseWhitespace": {
        return output.replace(/\s+/g, " ");
      }
      case "trim": {
        return output.trim();
      }
      default:
        return output;
    }
  }, input);
}

// ============================================================================
// Text Comparison Logic (mirrors server-side evaluation.ts)
// ============================================================================

type DiffStats = {
  distance: number;
  substitutions: number;
  omissions: number;
  additions: number;
};

function computeEditStats(source: string, target: string): DiffStats {
  const sourceLength = source.length;
  const targetLength = target.length;

  const dp: number[][] = Array.from({ length: sourceLength + 1 }, () =>
    Array.from({ length: targetLength + 1 }, () => 0)
  );

  for (let i = 0; i <= sourceLength; i += 1) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= targetLength; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= sourceLength; i += 1) {
    for (let j = 1; j <= targetLength; j += 1) {
      if (source[i - 1] === target[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        continue;
      }

      const substitute = dp[i - 1][j - 1] + 1;
      const remove = dp[i - 1][j] + 1;
      const insert = dp[i][j - 1] + 1;
      dp[i][j] = Math.min(substitute, remove, insert);
    }
  }

  let substitutions = 0;
  let omissions = 0;
  let additions = 0;

  let i = sourceLength;
  let j = targetLength;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && source[i - 1] === target[j - 1]) {
      if (dp[i][j] === dp[i - 1][j - 1]) {
        i -= 1;
        j -= 1;
        continue;
      }
    }

    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions += 1;
      i -= 1;
      j -= 1;
      continue;
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      omissions += 1;
      i -= 1;
      continue;
    }

    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      additions += 1;
      j -= 1;
      continue;
    }

    if (i > 0) {
      omissions += 1;
      i -= 1;
      continue;
    }

    additions += 1;
    j -= 1;
  }

  return {
    distance: dp[sourceLength][targetLength],
    substitutions,
    omissions,
    additions,
  };
}

/**
 * Compare two text strings and compute fidelity score.
 */
export function compareText(canonical: string, candidate: string): {
  fidelityScore: number;
  diff: DiffSummary;
} {
  const stats = computeEditStats(canonical, candidate);
  const maxLength = Math.max(canonical.length, candidate.length);
  const ratio = maxLength === 0 ? 1 : Math.max(0, 1 - stats.distance / maxLength);
  const fidelityScore = Number((ratio * 100).toFixed(2));

  const diff: DiffSummary = {
    substitutions: stats.substitutions,
    omissions: stats.omissions,
    additions: stats.additions,
    transpositions: 0,
  };

  return { fidelityScore, diff };
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Apply transform steps to LLM text and compute fidelity score against canonical.
 * This is the main entry point for client-side re-scoring.
 */
export function applyTransformsAndScore(
  llmText: string,
  canonicalText: string,
  transforms: TransformStep[]
): TransformResult {
  const normalizedText = applyTransformSteps(llmText, transforms);
  const { fidelityScore, diff } = compareText(canonicalText, normalizedText);
  return { normalizedText, fidelityScore, diff };
}

/**
 * Default cosmetic normalization transforms for Unicode characters.
 * These can be used as a baseline for client-side normalization.
 */
export const DEFAULT_COSMETIC_TRANSFORMS: TransformStep[] = [
  {
    order: 1,
    type: "replaceMap",
    enabled: true,
    severity: "cosmetic",
    description: "Normalize curly apostrophes and quotes to straight",
    params: {
      map: {
        "\u2018": "'", // Left single quote
        "\u2019": "'", // Right single quote
        "\u201C": '"', // Left double quote
        "\u201D": '"', // Right double quote
        "\u2014": "-", // Em dash
        "\u2013": "-", // En dash
      },
    },
  },
  {
    order: 2,
    type: "collapseWhitespace",
    enabled: true,
    severity: "cosmetic",
    description: "Collapse multiple whitespace to single space",
    params: {},
  },
  {
    order: 3,
    type: "trim",
    enabled: true,
    severity: "cosmetic",
    description: "Trim leading and trailing whitespace",
    params: {},
  },
];

/**
 * Check if a transform step is enabled and should be applied.
 */
export function isTransformEnabled(step: TransformStep): boolean {
  return step.enabled;
}

/**
 * Create a toggle-able copy of transform steps.
 */
export function createToggleableSteps(
  steps: TransformStep[]
): Array<TransformStep & { selected: boolean }> {
  return steps.map((step) => ({
    ...step,
    selected: step.enabled,
  }));
}
