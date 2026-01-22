import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { DimBookModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * GET /api/admin/dimensions/books
 *
 * Returns books, optionally filtered by bibleId.
 *
 * Query params:
 *   bibleId - Filter by bible (optional)
 */
export async function GET(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const bibleIdParam = searchParams.get("bibleId");

  const filter: Record<string, unknown> = {};
  if (bibleIdParam) {
    const bibleId = Number(bibleIdParam);
    if (Number.isFinite(bibleId)) {
      filter.bibleId = bibleId;
    }
  }

  await connectToDatabase();

  const books = await DimBookModel.find(filter, {
    _id: 0,
    bookId: 1,
    bibleId: 1,
    bookCode: 1,
    bookName: 1,
    bookIndex: 1,
  })
    .sort({ bookIndex: 1 })
    .lean();

  const data = books.map((book) => ({
    id: book.bookId,
    bibleId: book.bibleId,
    code: book.bookCode,
    name: book.bookName,
    index: book.bookIndex,
  }));

  return NextResponse.json({ ok: true, data });
}
