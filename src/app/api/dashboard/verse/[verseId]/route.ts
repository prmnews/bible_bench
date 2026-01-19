import { NextResponse } from "next/server";

import { VerseResultModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET(
  request: Request,
  { params }: { params: { verseId: string } }
) {
  const verseId = Number(params.verseId);
  if (!Number.isFinite(verseId)) {
    return NextResponse.json({ ok: false, error: "verseId must be a number." }, { status: 400 });
  }

  await connectToDatabase();
  const results = await VerseResultModel.find(
    { verseId },
    { _id: 0, runId: 1, modelId: 1, hashMatch: 1, fidelityScore: 1, diff: 1 }
  )
    .sort({ modelId: 1 })
    .lean();

  return NextResponse.json({ ok: true, data: { verseId, results } });
}
