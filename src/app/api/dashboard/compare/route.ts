import { NextResponse } from "next/server";

import {
  BibleAggregateModel,
  ModelModel,
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * GET /api/dashboard/compare
 *
 * Compare model performance side-by-side.
 * Returns time-series data for multiple models.
 *
 * Query params:
 *   modelIds - comma-separated list of model IDs (optional, defaults to all active)
 *   bibleId - filter by specific bible (optional)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const modelIdsParam = url.searchParams.get("modelIds");
  const bibleIdParam = url.searchParams.get("bibleId");

  await connectToDatabase();

  // Get models to compare
  let modelFilter: Record<string, unknown> = { isActive: true };
  if (modelIdsParam) {
    const modelIds = modelIdsParam.split(",").map((id) => Number(id.trim())).filter(Number.isFinite);
    if (modelIds.length > 0) {
      modelFilter = { modelId: { $in: modelIds } };
    }
  }

  const models = await ModelModel.find(
    modelFilter,
    { _id: 0, modelId: 1, displayName: 1, provider: 1, version: 1, releasedAt: 1 }
  )
    .sort({ modelId: 1 })
    .lean();

  if (models.length === 0) {
    return NextResponse.json({
      ok: true,
      data: { models: [], comparison: [], timeSeries: [] },
    });
  }

  const modelIds = models.map((m) => m.modelId);

  // Build aggregation filter
  const aggFilter: Record<string, unknown> = { modelId: { $in: modelIds } };
  if (bibleIdParam) {
    const bibleId = Number(bibleIdParam);
    if (Number.isFinite(bibleId)) {
      aggFilter.bibleId = bibleId;
    }
  }

  // Get latest bible aggregate for each model
  const latestAggregates = await BibleAggregateModel.aggregate([
    { $match: aggFilter },
    { $sort: { evaluatedAt: -1 } },
    {
      $group: {
        _id: "$modelId",
        bibleId: { $first: "$bibleId" },
        runId: { $first: "$runId" },
        avgFidelity: { $first: "$avgFidelity" },
        perfectRate: { $first: "$perfectRate" },
        verseCount: { $first: "$verseCount" },
        evaluatedAt: { $first: "$evaluatedAt" },
      },
    },
    { $sort: { avgFidelity: -1 } }, // Sort by score descending for ranking
  ]);

  // Get time series for all models
  const timeSeries = await BibleAggregateModel.find(
    aggFilter,
    { _id: 0, modelId: 1, bibleId: 1, avgFidelity: 1, perfectRate: 1, evaluatedAt: 1 }
  )
    .sort({ evaluatedAt: 1 })
    .lean();

  // Build comparison table
  const comparison = latestAggregates.map((agg, index) => {
    const model = models.find((m) => m.modelId === agg._id);
    return {
      rank: index + 1,
      modelId: agg._id,
      displayName: model?.displayName ?? `Model ${agg._id}`,
      provider: model?.provider,
      version: model?.version,
      avgFidelity: agg.avgFidelity,
      perfectRate: agg.perfectRate,
      verseCount: agg.verseCount,
      evaluatedAt: agg.evaluatedAt?.toISOString?.(),
    };
  });

  // Format time series for charting
  const timeSeriesFormatted = timeSeries.map((agg) => ({
    modelId: agg.modelId,
    bibleId: agg.bibleId,
    avgFidelity: agg.avgFidelity,
    perfectRate: agg.perfectRate,
    evaluatedAt: (agg.evaluatedAt as Date)?.toISOString(),
  }));

  // Format models with releasedAt
  const formattedModels = models.map((m) => ({
    ...m,
    releasedAt: (m.releasedAt as Date)?.toISOString?.() ?? null,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      models: formattedModels,
      comparison,
      timeSeries: timeSeriesFormatted,
    },
  });
}
