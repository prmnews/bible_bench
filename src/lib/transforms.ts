type TransformStep = {
  order: number;
  type:
    | "stripMarkupTags"
    | "stripParagraphMarkers"
    | "stripVerseNumbers"
    | "stripHeadings"
    | "regexReplace"
    | "replaceMap"
    | "collapseWhitespace"
    | "trim";
  enabled: boolean;
  params: Record<string, unknown>;
};

type TransformProfile = {
  profileId: number;
  name: string;
  scope: "canonical" | "model_output";
  version?: number;
  bibleId?: number;
  isDefault?: boolean;
  description?: string;
  steps: TransformStep[];
  isActive: boolean;
};

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

function stripMarkupTags(input: string, tagNames: string[]) {
  if (tagNames.length === 0) {
    return input;
  }

  return tagNames.reduce((acc, tag) => {
    const regex = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
    return acc.replaceAll(regex, "");
  }, input);
}

function stripByPatterns(input: string, patterns: string[]) {
  return patterns.reduce((acc, pattern) => {
    try {
      const regex = new RegExp(pattern, "g");
      return acc.replaceAll(regex, "");
    } catch {
      return acc;
    }
  }, input);
}

function regexReplace(input: string, pattern: string | null, replacement: string) {
  if (!pattern) {
    return input;
  }

  try {
    const regex = new RegExp(pattern, "g");
    return input.replaceAll(regex, replacement);
  } catch {
    return input;
  }
}

function applyReplaceMap(input: string, map: Record<string, string>) {
  return Object.entries(map).reduce((acc, [key, value]) => {
    if (!key) {
      return acc;
    }
    return acc.split(key).join(value);
  }, input);
}

export function applyTransformProfile(input: string, profile: TransformProfile) {
  const ordered = [...profile.steps].sort((a, b) => a.order - b.order);
  return ordered.reduce((output, step) => {
    if (!step.enabled) {
      return output;
    }

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

export type { TransformProfile, TransformStep };
