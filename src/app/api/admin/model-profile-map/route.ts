import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { ModelProfileMapModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type ModelProfileMapPayload = {
  modelId: number;
  modelProfileId: number;
};

type ValidationResult =
  | { ok: true; data: ModelProfileMapPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePayload(payload: unknown): ValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const modelId = payload["modelId"];
  if (!isNumber(modelId)) {
    return { ok: false, error: "modelId must be a number." };
  }

  const modelProfileId = payload["modelProfileId"];
  if (!isNumber(modelProfileId)) {
    return { ok: false, error: "modelProfileId must be a number." };
  }

  return {
    ok: true,
    data: {
      modelId,
      modelProfileId,
    },
  };
}

export const runtime = "nodejs";

export async function GET() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  await connectToDatabase();
  const mappings = await ModelProfileMapModel.find({}, { _id: 0 })
    .sort({ modelId: 1 })
    .lean();
  return NextResponse.json({ ok: true, data: mappings });
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

  const mapping = await ModelProfileMapModel.findOneAndUpdate(
    { modelId: validation.data.modelId },
    {
      $set: {
        modelProfileId: validation.data.modelProfileId,
      },
      $setOnInsert: {
        audit: {
          createdAt: now,
          createdBy: "admin",
        },
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ ok: true, data: { modelId: mapping.modelId } });
}
