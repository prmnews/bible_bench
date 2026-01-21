import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { DimLanguageModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * GET /api/admin/dimensions/languages
 *
 * Returns all languages from dimLanguages.
 */
export async function GET() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  await connectToDatabase();

  const languages = await DimLanguageModel.find(
    {},
    { _id: 0, languageId: 1, isoCode: 1, name: 1 }
  )
    .sort({ languageId: 1 })
    .lean();

  const data = languages.map((lang) => ({
    id: lang.languageId,
    isoCode: lang.isoCode,
    name: lang.name,
  }));

  return NextResponse.json({ ok: true, data });
}
