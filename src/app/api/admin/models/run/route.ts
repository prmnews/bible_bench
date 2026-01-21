import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { startModelRun } from "@/lib/model-runs";
import { ModelModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * POST /api/admin/models/run
 *
 * Launch model runs for multiple models with specified scope.
 *
 * Request body:
 * {
 *   modelIds: number[],           // Array of model IDs to run
 *   scope: "book" | "chapter",    // Scope level
 *   scopeIds: {                   // Scope identifiers
 *     bookId?: number,            // For book scope
 *     chapterIds?: number[]       // For chapter scope (multiple chapters)
 *   },
 *   limit?: number,               // Optional limit per run
 *   skip?: number                 // Optional skip offset
 * }
 */

type RunPayload = {
  modelIds: number[];
  scope: "book" | "chapter";
  scopeIds: {
    bookId?: number;
    chapterIds?: number[];
  };
  limit?: number;
  skip?: number;
};

type ValidationResult =
  | { ok: true; data: RunPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(payload: unknown): ValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  // Validate modelIds
  const modelIds = payload["modelIds"];
  if (!Array.isArray(modelIds) || modelIds.length === 0) {
    return { ok: false, error: "modelIds must be a non-empty array." };
  }
  const validModelIds = modelIds.filter(
    (id) => typeof id === "number" && Number.isFinite(id)
  );
  if (validModelIds.length !== modelIds.length) {
    return { ok: false, error: "modelIds must contain only numbers." };
  }

  // Validate scope
  const scope = payload["scope"];
  if (scope !== "book" && scope !== "chapter") {
    return { ok: false, error: 'scope must be "book" or "chapter".' };
  }

  // Validate scopeIds
  const scopeIds = payload["scopeIds"];
  if (!isRecord(scopeIds)) {
    return { ok: false, error: "scopeIds must be an object." };
  }

  if (scope === "book") {
    const bookId = scopeIds["bookId"];
    if (typeof bookId !== "number" || !Number.isFinite(bookId)) {
      return { ok: false, error: "scopeIds.bookId must be a number for book scope." };
    }
  }

  if (scope === "chapter") {
    const chapterIds = scopeIds["chapterIds"];
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      return {
        ok: false,
        error: "scopeIds.chapterIds must be a non-empty array for chapter scope.",
      };
    }
    const validChapterIds = chapterIds.filter(
      (id) => typeof id === "number" && Number.isFinite(id)
    );
    if (validChapterIds.length !== chapterIds.length) {
      return { ok: false, error: "scopeIds.chapterIds must contain only numbers." };
    }
  }

  // Validate optional fields
  const limit = payload["limit"];
  if (limit !== undefined && (typeof limit !== "number" || !Number.isFinite(limit))) {
    return { ok: false, error: "limit must be a number." };
  }

  const skip = payload["skip"];
  if (skip !== undefined && (typeof skip !== "number" || !Number.isFinite(skip))) {
    return { ok: false, error: "skip must be a number." };
  }

  return {
    ok: true,
    data: {
      modelIds: validModelIds as number[],
      scope: scope as "book" | "chapter",
      scopeIds: {
        bookId: scopeIds["bookId"] as number | undefined,
        chapterIds: scopeIds["chapterIds"] as number[] | undefined,
      },
      limit: limit as number | undefined,
      skip: skip as number | undefined,
    },
  };
}

type RunResult = {
  modelId: number;
  runId: string;
  ok: boolean;
  status?: string;
  metrics?: Record<string, unknown>;
  error?: string;
};

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

  // Verify all models exist and are active
  const models = await ModelModel.find(
    { modelId: { $in: validation.data.modelIds }, isActive: true },
    { modelId: 1, displayName: 1 }
  ).lean();

  const activeModelIds = new Set(models.map((m) => m.modelId));
  const missingModels = validation.data.modelIds.filter((id) => !activeModelIds.has(id));
  if (missingModels.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Models not found or inactive: ${missingModels.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const results: RunResult[] = [];

  // For chapter scope with multiple chapters, we run each chapter for each model
  if (validation.data.scope === "chapter" && validation.data.scopeIds.chapterIds) {
    const chapterIds = validation.data.scopeIds.chapterIds;

    for (const modelId of validation.data.modelIds) {
      for (const chapterId of chapterIds) {
        try {
          const result = await startModelRun({
            modelId,
            runType: "MODEL_CHAPTER",
            scope: "chapter",
            scopeIds: { chapterId },
            limit: validation.data.limit,
            skip: validation.data.skip,
          });

          if (result.ok) {
            results.push({
              modelId,
              runId: result.data.runId,
              ok: true,
              status: result.data.status,
              metrics: result.data.metrics,
            });
          } else {
            results.push({
              modelId,
              runId: "",
              ok: false,
              error: result.error,
            });
          }
        } catch (err) {
          results.push({
            modelId,
            runId: "",
            ok: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }
  } else if (validation.data.scope === "book" && validation.data.scopeIds.bookId) {
    // For book scope, run all chapters in the book for each model
    const bookId = validation.data.scopeIds.bookId;

    for (const modelId of validation.data.modelIds) {
      try {
        const result = await startModelRun({
          modelId,
          runType: "MODEL_CHAPTER",
          scope: "book",
          scopeIds: { bookId },
          limit: validation.data.limit,
          skip: validation.data.skip,
        });

        if (result.ok) {
          results.push({
            modelId,
            runId: result.data.runId,
            ok: true,
            status: result.data.status,
            metrics: result.data.metrics,
          });
        } else {
          results.push({
            modelId,
            runId: "",
            ok: false,
            error: result.error,
          });
        }
      } catch (err) {
        results.push({
          modelId,
          runId: "",
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  const allOk = results.every((r) => r.ok);
  const successCount = results.filter((r) => r.ok).length;
  const failedCount = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    ok: allOk,
    data: {
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount,
      },
    },
  });
}
