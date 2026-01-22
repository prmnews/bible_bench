import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { DimChapterModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * GET /api/admin/dimensions/chapters
 *
 * Returns chapters, optionally filtered by bookId or bibleId.
 *
 * Query params:
 *   bookId - Filter by book (optional)
 *   bibleId - Filter by bible (optional)
 */
export async function GET(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const bookIdParam = searchParams.get("bookId");
  const bibleIdParam = searchParams.get("bibleId");

  const filter: Record<string, unknown> = {};
  if (bookIdParam) {
    const bookId = Number(bookIdParam);
    if (Number.isFinite(bookId)) {
      filter.bookId = bookId;
    }
  }
  if (bibleIdParam) {
    const bibleId = Number(bibleIdParam);
    if (Number.isFinite(bibleId)) {
      filter.bibleId = bibleId;
    }
  }

  await connectToDatabase();

  const chapters = await DimChapterModel.find(filter, {
    _id: 0,
    chapterId: 1,
    bibleId: 1,
    bookId: 1,
    chapterNumber: 1,
    reference: 1,
    chapterName: 1,
    verseCount: 1,
  })
    .sort({ chapterNumber: 1 })
    .lean();

  const data = chapters.map((ch) => ({
    id: ch.chapterId,
    bibleId: ch.bibleId,
    bookId: ch.bookId,
    number: ch.chapterNumber,
    reference: ch.reference,
    name: ch.chapterName,
    verseCount: ch.verseCount,
  }));

  return NextResponse.json({ ok: true, data });
}
