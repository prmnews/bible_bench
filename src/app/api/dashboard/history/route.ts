import { NextResponse } from "next/server";

import { ChapterResultModel, RunModel, VerseResultModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type AggregateRow = {
  _id: string;
  total: number;
  matches: number;
  avgFidelity: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelIdValue = searchParams.get("modelId");
  const modelId = modelIdValue ? Number(modelIdValue) : Number.NaN;
  if (!Number.isFinite(modelId)) {
    return NextResponse.json({ ok: false, error: "modelId must be a number." }, { status: 400 });
  }

  await connectToDatabase();
  const runs = await RunModel.find(
    { modelId },
    { _id: 0, runId: 1, runType: 1, status: 1, startedAt: 1, completedAt: 1 }
  )
    .sort({ startedAt: 1 })
    .lean();

  const [chapterAgg, verseAgg] = await Promise.all([
    ChapterResultModel.aggregate<AggregateRow>([
      { $match: { modelId } },
      {
        $group: {
          _id: "$runId",
          total: { $sum: 1 },
          matches: {
            $sum: { $cond: [{ $eq: ["$hashMatch", true] }, 1, 0] },
          },
          avgFidelity: { $avg: "$fidelityScore" },
        },
      },
    ]),
    VerseResultModel.aggregate<AggregateRow>([
      { $match: { modelId } },
      {
        $group: {
          _id: "$runId",
          total: { $sum: 1 },
          matches: {
            $sum: { $cond: [{ $eq: ["$hashMatch", true] }, 1, 0] },
          },
          avgFidelity: { $avg: "$fidelityScore" },
        },
      },
    ]),
  ]);

  const metricsByRun = new Map<
    string,
    { total: number; matches: number; fidelitySum: number }
  >();

  const mergeRow = (row: AggregateRow) => {
    const existing = metricsByRun.get(row._id) ?? { total: 0, matches: 0, fidelitySum: 0 };
    const fidelitySum = row.avgFidelity * row.total;
    metricsByRun.set(row._id, {
      total: existing.total + row.total,
      matches: existing.matches + row.matches,
      fidelitySum: existing.fidelitySum + fidelitySum,
    });
  };

  chapterAgg.forEach(mergeRow);
  verseAgg.forEach(mergeRow);

  const history = runs.map((run) => {
    const metrics = metricsByRun.get(run.runId) ?? { total: 0, matches: 0, fidelitySum: 0 };
    const perfectRate = metrics.total === 0 ? 0 : Number((metrics.matches / metrics.total).toFixed(4));
    const avgFidelity =
      metrics.total === 0 ? 0 : Number((metrics.fidelitySum / metrics.total).toFixed(2));

    return {
      runId: run.runId,
      runType: run.runType,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
      total: metrics.total,
      perfectRate,
      avgFidelity,
    };
  });

  return NextResponse.json({ ok: true, data: { modelId, history } });
}
