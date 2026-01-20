import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { AppConfigModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeValue(key: string, value: unknown): string | null {
  // Special handling for boolean-like keys
  if (key === "SHOW_LATEST_ONLY") {
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    if (typeof value === "number") {
      if (value === 1) return "1";
      if (value === 0) return "0";
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === "1" || trimmed === "true") return "1";
      if (trimmed === "0" || trimmed === "false") return "0";
      return null;
    }
    return null;
  }

  // For other keys, accept any string value
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

// Key validation: alphanumeric, underscores, hyphens only
function isValidKey(key: string): boolean {
  return /^[A-Z0-9_-]+$/i.test(key) && key.length > 0 && key.length <= 100;
}

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

// GET - Retrieve a config value
export async function GET(
  _request: Request,
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

  await connectToDatabase();
  const config = await AppConfigModel.findOne({ key }, { _id: 0 }).lean();

  if (!config) {
    return NextResponse.json({ ok: false, error: "Config key not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: config });
}

// PUT - Create or update a config value
export async function PUT(
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
  if (!isValidKey(key)) {
    return NextResponse.json(
      { ok: false, error: "Invalid config key. Use alphanumeric characters, underscores, or hyphens." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ ok: false, error: "Body must be a JSON object." }, { status: 400 });
  }

  const rawValue = body["value"];
  if (rawValue === undefined) {
    return NextResponse.json({ ok: false, error: "value is required." }, { status: 400 });
  }

  const normalizedValue = normalizeValue(key, rawValue);
  if (normalizedValue === null) {
    return NextResponse.json({ ok: false, error: "Invalid value format." }, { status: 400 });
  }

  await connectToDatabase();
  const now = new Date();

  await AppConfigModel.updateOne(
    { key },
    {
      $set: {
        value: normalizedValue,
        modifiedAt: now,
        modifiedBy: "admin",
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, data: { key, value: normalizedValue } });
}

// DELETE - Remove a config value
export async function DELETE(
  _request: Request,
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

  await connectToDatabase();
  const result = await AppConfigModel.deleteOne({ key });

  if (result.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Config key not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { deleted: key } });
}

// PATCH - Update an existing config value (legacy support)
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  // Forward to PUT for backward compatibility
  return PUT(request, { params });
}
