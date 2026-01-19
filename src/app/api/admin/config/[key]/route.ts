import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { AppConfigModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

const allowedKeys = new Set(["SHOW_LATEST_ONLY"]);

type ValidationResult =
  | { ok: true; data: { value: string } }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeShowLatestOnly(value: string | number | boolean) {
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (typeof value === "number") {
    if (value === 1) {
      return "1";
    }
    if (value === 0) {
      return "0";
    }
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === "1" || trimmed === "true") {
    return "1";
  }
  if (trimmed === "0" || trimmed === "false") {
    return "0";
  }
  return null;
}

function validatePayload(key: string, payload: unknown): ValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const value = payload["value"] as unknown;
  if (value === undefined) {
    return { ok: false, error: "value is required." };
  }

  if (key === "SHOW_LATEST_ONLY") {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return { ok: false, error: "value must be a string, number, or boolean." };
    }
    const normalized = normalizeShowLatestOnly(value);
    if (!normalized) {
      return { ok: false, error: "value must be 0/1 or true/false for SHOW_LATEST_ONLY." };
    }
    return { ok: true, data: { value: normalized } };
  }

  return { ok: false, error: "Unsupported config key." };
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
  const keyParam = resolvedParams["key"];
  const key = Array.isArray(keyParam) ? keyParam[0] : keyParam;
  if (!key) {
    return NextResponse.json({ ok: false, error: "Config key is required." }, { status: 400 });
  }
  if (!allowedKeys.has(key)) {
    return NextResponse.json({ ok: false, error: "Unsupported config key." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validatePayload(key, body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  await connectToDatabase();
  const now = new Date();

  await AppConfigModel.updateOne(
    { key },
    {
      $set: {
        value: validation.data.value,
        modifiedAt: now,
        modifiedBy: "admin",
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, data: { key, value: validation.data.value } });
}
