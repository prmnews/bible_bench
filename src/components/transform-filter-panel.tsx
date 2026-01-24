"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { ArrowsClockwise, Funnel, Info, CheckSquare, Square } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  type TransformStep,
  type TransformSeverity,
  getSeverityInfo,
  DEFAULT_COSMETIC_TRANSFORMS,
} from "@/lib/client-transforms";

// ============================================================================
// Types
// ============================================================================

type TransformStepWithProfile = TransformStep & {
  profileId: number;
  profileName: string;
};

type TransformProfile = {
  profileId: number;
  name: string;
  scope: "canonical" | "model_output";
  description: string | null;
  steps: TransformStep[];
  isActive: boolean;
};

type TransformFilterPanelProps = {
  onTransformsChange: (transforms: TransformStep[]) => void;
  className?: string;
  initialEnabled?: boolean;
};

// ============================================================================
// Severity Badge Component
// ============================================================================

function SeverityBadge({ severity }: { severity: TransformSeverity | undefined }) {
  const info = getSeverityInfo(severity);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        severity === "cosmetic" && "bg-green-500/10 text-green-600 dark:text-green-400",
        severity === "minor" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        severity === "significant" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        severity === "critical" && "bg-red-500/10 text-red-600 dark:text-red-400",
        !severity && "bg-muted text-muted-foreground"
      )}
      title={info.description}
    >
      {info.label}
    </span>
  );
}

// ============================================================================
// Transform Step Toggle Component
// ============================================================================

type StepToggleProps = {
  step: TransformStep;
  profileName: string;
  isSelected: boolean;
  onToggle: () => void;
};

function StepToggle({ step, profileName, isSelected, onToggle }: StepToggleProps) {
  const description = step.description ?? `${step.type} transform`;

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
        "hover:bg-accent/50",
        isSelected && "bg-accent/30"
      )}
    >
      {isSelected ? (
        <CheckSquare className="h-4 w-4 text-primary shrink-0" weight="fill" />
      ) : (
        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {description}
          </span>
          <SeverityBadge severity={step.severity} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{profileName}</span>
          <span>•</span>
          <code className="rounded bg-muted px-1">{step.type}</code>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TransformFilterPanel({
  onTransformsChange,
  className,
  initialEnabled = false,
}: TransformFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [profiles, setProfiles] = useState<TransformProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<Set<string>>(new Set());

  // Create a unique key for each step
  const getStepKey = useCallback((profileId: number, step: TransformStep) => {
    return `${profileId}-${step.order}-${step.type}`;
  }, []);

  // Fetch profiles on mount
  useEffect(() => {
    async function fetchProfiles() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/transforms?scope=model_output&activeOnly=true");
        const json = await res.json();
        if (json.ok) {
          setProfiles(json.data.profiles);
        }
      } catch (error) {
        console.error("Failed to fetch transform profiles:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfiles();
  }, []);

  // Flatten all steps from all profiles (memoized to prevent infinite loops)
  const allSteps: TransformStepWithProfile[] = useMemo(() => {
    return profiles.flatMap((profile) =>
      profile.steps
        .filter((step) => step.enabled)
        .map((step) => ({
          ...step,
          profileId: profile.profileId,
          profileName: profile.name,
        }))
    );
  }, [profiles]);

  // Toggle a step selection
  const handleToggleStep = useCallback(
    (profileId: number, step: TransformStep) => {
      const key = getStepKey(profileId, step);
      setSelectedSteps((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [getStepKey]
  );

  // Update parent when selections or enabled state change
  useEffect(() => {
    if (!isEnabled) {
      onTransformsChange([]);
      return;
    }

    const selectedTransforms = allSteps.filter((step) =>
      selectedSteps.has(getStepKey(step.profileId, step))
    );

    onTransformsChange(selectedTransforms);
  }, [selectedSteps, isEnabled, allSteps, getStepKey, onTransformsChange]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setSelectedSteps(new Set());
    setIsEnabled(false);
  }, []);

  // Select all cosmetic transforms
  const handleSelectCosmetic = useCallback(() => {
    const cosmeticKeys = new Set(
      allSteps
        .filter((step) => step.severity === "cosmetic")
        .map((step) => getStepKey(step.profileId, step))
    );
    setSelectedSteps(cosmeticKeys);
    setIsEnabled(true);
  }, [allSteps, getStepKey]);

  // Use default transforms (built-in)
  const handleUseDefaults = useCallback(() => {
    // For defaults, we'll create virtual steps
    const defaultKeys = new Set(
      DEFAULT_COSMETIC_TRANSFORMS.map((step) => `default-${step.order}-${step.type}`)
    );
    setSelectedSteps(defaultKeys);
    setIsEnabled(true);
    // Notify parent with default transforms
    onTransformsChange(DEFAULT_COSMETIC_TRANSFORMS);
  }, [onTransformsChange]);

  const selectedCount = selectedSteps.size;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <Funnel className="h-4 w-4" />
          <span>Normalization Filters</span>
          {selectedCount > 0 && isEnabled && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {selectedCount} active
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Enable/Disable toggle */}
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              isEnabled
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {isEnabled ? "Enabled" : "Disabled"}
          </button>

          {/* Reset button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 w-8 p-0"
            title="Reset filters"
          >
            <ArrowsClockwise className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Quick actions */}
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Button variant="outline" size="sm" onClick={handleUseDefaults}>
              Use Defaults
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectCosmetic}>
              All Cosmetic
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>Select transforms to normalize scores</span>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Loading transform profiles...
            </div>
          )}

          {/* No profiles */}
          {!loading && allSteps.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              <p>No transform profiles found.</p>
              <Button
                variant="link"
                size="sm"
                onClick={handleUseDefaults}
                className="mt-2"
              >
                Use built-in defaults
              </Button>
            </div>
          )}

          {/* Step list */}
          {!loading && allSteps.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {allSteps.map((step) => (
                <StepToggle
                  key={getStepKey(step.profileId, step)}
                  step={step}
                  profileName={step.profileName}
                  isSelected={selectedSteps.has(getStepKey(step.profileId, step))}
                  onToggle={() => handleToggleStep(step.profileId, step)}
                />
              ))}
            </div>
          )}

          {/* Severity legend */}
          <div className="pt-2 border-t border-border">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium">Severity:</span>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span>Cosmetic</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                <span>Minor</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                <span>Significant</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                <span>Critical</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { TransformProfile, TransformStepWithProfile };
