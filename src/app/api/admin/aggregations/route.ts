import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { recomputeAllAggregatesBulk } from "@/lib/aggregation";

export const runtime = "nodejs";

/**
 * POST /api/admin/aggregations
 *
 * Recompute all aggregation collections (chapters, books, bibles)
 * from llmVerseResults. This is idempotent and can be run at any time.
 */
export async function POST() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const result = await recomputeAllAggregatesBulk();

    const hasErrors = result.errors.length > 0;

    return NextResponse.json({
      ok: !hasErrors,
      data: {
        chaptersProcessed: result.chaptersProcessed,
        booksProcessed: result.booksProcessed,
        biblesProcessed: result.biblesProcessed,
        errors: result.errors,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aggregation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
