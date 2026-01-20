import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { applySchemaValidators, SchemaValidatorRunModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type ValidatorPayload = {
  dryRun?: boolean;
};

type ValidationResult =
  | { ok: true; data: Required<ValidatorPayload> }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(payload: unknown): ValidationResult {
  if (payload === undefined || payload === null) {
    return { ok: true, data: { dryRun: false } };
  }

  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const dryRunValue = payload["dryRun"];
  if (dryRunValue !== undefined && typeof dryRunValue !== "boolean") {
    return { ok: false, error: "dryRun must be a boolean." };
  }

  return { ok: true, data: { dryRun: dryRunValue ?? false } };
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  let body: unknown = undefined;
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

  try {
    const startedAt = new Date();
    const results = await applySchemaValidators({ dryRun: validation.data.dryRun });
    const completedAt = new Date();
    const success = results.every((result) => result.ok);
    const runId = randomUUID();

    await SchemaValidatorRunModel.create({
      runId,
      dryRun: validation.data.dryRun,
      startedAt,
      completedAt,
      success,
      results,
      audit: {
        createdAt: startedAt,
        createdBy: "admin",
      },
    });

    const failedResults = results.filter((r) => !r.ok);
    const errorMessage = failedResults.length > 0
      ? `Failed on: ${failedResults.map((r) => `${r.name} (${r.error})`).join(", ")}`
      : undefined;

    return NextResponse.json(
      {
        ok: success,
        error: errorMessage,
        data: {
          runId,
          dryRun: validation.data.dryRun,
          startedAt,
          completedAt,
          success,
          results,
        },
      },
      { status: success ? 200 : 500 }
    );
  } catch (error) {
    console.error("[schema/validators] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to apply validators.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
