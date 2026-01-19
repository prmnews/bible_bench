type ModelResponseParams = {
  targetType: "chapter" | "verse";
  targetId: number;
  canonicalRaw: string;
  canonicalProcessed: string;
  model: {
    apiConfigEncrypted?: Record<string, unknown> | null;
  };
};

type ModelResponseResult = {
  responseRaw: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(([, entry]) => typeof entry === "string");
  return Object.fromEntries(entries) as Record<string, string>;
}

type MockConfig = {
  mode?: "echo_raw" | "echo_processed" | "literal";
  literalResponse?: string;
  overrides?: Record<string, string>;
};

function resolveMockConfig(config: Record<string, unknown> | null | undefined): MockConfig {
  if (!isRecord(config)) {
    return {};
  }

  const source = isRecord(config["mock"]) ? (config["mock"] as Record<string, unknown>) : config;
  const mode = getString(source["mode"]) as MockConfig["mode"] | null;
  const literalResponse = getString(source["literalResponse"]);
  const overrides = getStringMap(source["overrides"]);

  return {
    mode: mode ?? undefined,
    literalResponse: literalResponse ?? undefined,
    overrides,
  };
}

export async function generateModelResponse(
  params: ModelResponseParams
): Promise<ModelResponseResult> {
  const config = resolveMockConfig(params.model.apiConfigEncrypted);
  const targetKey = String(params.targetId);
  const override = config.overrides?.[targetKey];
  if (override !== undefined) {
    return { responseRaw: override };
  }

  switch (config.mode) {
    case "echo_processed":
      return { responseRaw: params.canonicalProcessed };
    case "literal":
      if (config.literalResponse !== undefined) {
        return { responseRaw: config.literalResponse };
      }
      return { responseRaw: params.canonicalRaw };
    case "echo_raw":
    default:
      return { responseRaw: params.canonicalRaw };
  }
}
