import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { ModelModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type ModelCapabilitiesPayload = {
  supportsJsonSchema?: boolean;
  supportsToolCalls?: boolean;
  supportsStrictJson?: boolean;
  supportsStreaming?: boolean;
};

type ModelPayload = {
  modelId: number;
  provider: string;
  displayName: string;
  version: string;
  routingMethod: string;
  isActive: boolean;
  apiConfigEncrypted?: Record<string, unknown> | null;
  capabilities?: ModelCapabilitiesPayload;
};

type ValidationResult =
  | { ok: true; data: ModelPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCapabilities(value: unknown): ModelCapabilitiesPayload | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const flags: ModelCapabilitiesPayload = {};
  const entries: Array<[keyof ModelCapabilitiesPayload, string]> = [
    ["supportsJsonSchema", "supportsJsonSchema"],
    ["supportsToolCalls", "supportsToolCalls"],
    ["supportsStrictJson", "supportsStrictJson"],
    ["supportsStreaming", "supportsStreaming"],
  ];

  for (const [key, field] of entries) {
    const valueForKey = value[field];
    if (valueForKey === undefined) {
      continue;
    }
    if (typeof valueForKey !== "boolean") {
      return null;
    }
    flags[key] = valueForKey;
  }

  return flags;
}

function validatePayload(payload: unknown): ValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const modelId = payload["modelId"];
  if (!isNumber(modelId)) {
    return { ok: false, error: "modelId must be a number." };
  }

  const provider = payload["provider"];
  if (typeof provider !== "string" || provider.trim().length === 0) {
    return { ok: false, error: "provider must be a non-empty string." };
  }

  const displayName = payload["displayName"];
  if (typeof displayName !== "string" || displayName.trim().length === 0) {
    return { ok: false, error: "displayName must be a non-empty string." };
  }

  const version = payload["version"];
  if (typeof version !== "string" || version.trim().length === 0) {
    return { ok: false, error: "version must be a non-empty string." };
  }

  const routingMethod = payload["routingMethod"];
  if (typeof routingMethod !== "string" || routingMethod.trim().length === 0) {
    return { ok: false, error: "routingMethod must be a non-empty string." };
  }

  const isActive = payload["isActive"];
  if (typeof isActive !== "boolean") {
    return { ok: false, error: "isActive must be a boolean." };
  }

  const apiConfigEncrypted = payload["apiConfigEncrypted"];
  if (apiConfigEncrypted !== undefined && apiConfigEncrypted !== null && !isRecord(apiConfigEncrypted)) {
    return { ok: false, error: "apiConfigEncrypted must be an object or null." };
  }

  const capabilities = validateCapabilities(payload["capabilities"]);
  if (payload["capabilities"] !== undefined && capabilities === null) {
    return { ok: false, error: "capabilities must be an object of boolean flags." };
  }

  return {
    ok: true,
    data: {
      modelId,
      provider: provider.trim(),
      displayName: displayName.trim(),
      version: version.trim(),
      routingMethod: routingMethod.trim(),
      isActive,
      apiConfigEncrypted: apiConfigEncrypted === undefined ? undefined : apiConfigEncrypted,
      capabilities: capabilities ?? undefined,
    },
  };
}

export const runtime = "nodejs";

export async function GET() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  await connectToDatabase();
  const models = await ModelModel.find({}, { _id: 0 })
    .sort({ modelId: 1 })
    .lean();
  return NextResponse.json({ ok: true, data: models });
}

export async function POST(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  await connectToDatabase();
  const now = new Date();

  const updateSet: Record<string, unknown> = {
    provider: validation.data.provider,
    displayName: validation.data.displayName,
    version: validation.data.version,
    routingMethod: validation.data.routingMethod,
    isActive: validation.data.isActive,
  };

  if (validation.data.apiConfigEncrypted !== undefined) {
    updateSet.apiConfigEncrypted = validation.data.apiConfigEncrypted ?? {};
  }

  if (validation.data.capabilities !== undefined) {
    updateSet.capabilities = validation.data.capabilities;
  }

  const model = await ModelModel.findOneAndUpdate(
    { modelId: validation.data.modelId },
    {
      $set: updateSet,
      $setOnInsert: {
        audit: {
          createdAt: now,
          createdBy: "admin",
        },
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ ok: true, data: { modelId: model.modelId } });
}
