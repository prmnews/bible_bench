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

type ModelUpdatePayload = {
  provider?: string;
  displayName?: string;
  version?: string;
  routingMethod?: string;
  isActive?: boolean;
  apiConfigEncrypted?: Record<string, unknown> | null;
  capabilities?: ModelCapabilitiesPayload;
};

type ValidationResult =
  | { ok: true; data: ModelUpdatePayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

  const update: ModelUpdatePayload = {};

  if (payload["provider"] !== undefined) {
    if (typeof payload["provider"] !== "string" || payload["provider"].trim().length === 0) {
      return { ok: false, error: "provider must be a non-empty string." };
    }
    update.provider = payload["provider"].trim();
  }

  if (payload["displayName"] !== undefined) {
    if (
      typeof payload["displayName"] !== "string" ||
      payload["displayName"].trim().length === 0
    ) {
      return { ok: false, error: "displayName must be a non-empty string." };
    }
    update.displayName = payload["displayName"].trim();
  }

  if (payload["version"] !== undefined) {
    if (typeof payload["version"] !== "string" || payload["version"].trim().length === 0) {
      return { ok: false, error: "version must be a non-empty string." };
    }
    update.version = payload["version"].trim();
  }

  if (payload["routingMethod"] !== undefined) {
    if (
      typeof payload["routingMethod"] !== "string" ||
      payload["routingMethod"].trim().length === 0
    ) {
      return { ok: false, error: "routingMethod must be a non-empty string." };
    }
    update.routingMethod = payload["routingMethod"].trim();
  }

  if (payload["isActive"] !== undefined) {
    if (typeof payload["isActive"] !== "boolean") {
      return { ok: false, error: "isActive must be a boolean." };
    }
    update.isActive = payload["isActive"];
  }

  if (payload["apiConfigEncrypted"] !== undefined) {
    const value = payload["apiConfigEncrypted"];
    if (value !== null && !isRecord(value)) {
      return { ok: false, error: "apiConfigEncrypted must be an object or null." };
    }
    update.apiConfigEncrypted = value as Record<string, unknown> | null;
  }

  if (payload["capabilities"] !== undefined) {
    const flags = validateCapabilities(payload["capabilities"]);
    if (flags === null) {
      return { ok: false, error: "capabilities must be an object of boolean flags." };
    }
    update.capabilities = flags;
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "At least one field must be provided for update." };
  }

  return { ok: true, data: update };
}

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const resolvedParams = await params;
  const modelIdValue = resolvedParams["modelId"];
  const modelId = Number(Array.isArray(modelIdValue) ? modelIdValue[0] : modelIdValue);
  if (!Number.isFinite(modelId)) {
    return NextResponse.json({ ok: false, error: "modelId must be a number." }, { status: 400 });
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
  const result = await ModelModel.findOneAndUpdate(
    { modelId },
    { $set: validation.data },
    { new: true }
  ).lean();

  if (!result) {
    return NextResponse.json({ ok: false, error: "Model not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { modelId: result.modelId } });
}
