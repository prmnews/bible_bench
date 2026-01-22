import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { DimBibleModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * GET /api/admin/dimensions/bibles
 *
 * Returns bibles, optionally filtered by languageId.
 *
 * Query params:
 *   languageId - Filter by language (optional)
 */
export async function GET(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const languageIdParam = searchParams.get("languageId");

  const filter: Record<string, unknown> = {};
  if (languageIdParam) {
    const languageId = Number(languageIdParam);
    if (Number.isFinite(languageId)) {
      filter.languageId = languageId;
    }
  }

  await connectToDatabase();

  const bibles = await DimBibleModel.find(filter, {
    _id: 0,
    bibleId: 1,
    languageId: 1,
    name: 1,
    source: 1,
  })
    .sort({ bibleId: 1 })
    .lean();

  const data = bibles.map((bible) => ({
    id: bible.bibleId,
    languageId: bible.languageId,
    name: bible.name,
    source: bible.source,
  }));

  return NextResponse.json({ ok: true, data });
}
