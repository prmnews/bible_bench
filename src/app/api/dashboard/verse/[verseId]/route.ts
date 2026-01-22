import { NextResponse } from "next/server";

import { LlmVerseResultModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const resolvedParams = await params;
  const verseIdValue = resolvedParams["verseId"];
  const verseId = Number(
    Array.isArray(verseIdValue) ? verseIdValue[0] : verseIdValue
  );
  if (!Number.isFinite(verseId)) {
    return NextResponse.json({ ok: false, error: "verseId must be a number." }, { status: 400 });
  }

  await connectToDatabase();
  const results = await LlmVerseResultModel.find(
    { verseId },
    { _id: 0, runId: 1, modelId: 1, hashMatch: 1, fidelityScore: 1, diff: 1 }
  )
    .sort({ modelId: 1 })
    .lean();

  return NextResponse.json({ ok: true, data: { verseId, results } });
}
