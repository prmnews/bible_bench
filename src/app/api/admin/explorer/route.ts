/**
 * Explorer API - Multi-level data fetching for campaign-driven results exploration
 *
 * Query params determine drill-down level:
 * - campaignTag only → Bible-level aggregations
 * - campaignTag + bibleId → Book-level aggregations
 * - campaignTag + bibleId + bookId → Chapter-level aggregations
 * - campaignTag + bibleId + bookId + chapterId → Verse-level comparison data
 *
 * Optional: modelId to filter by specific model
 */

import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import {
  AggregationBibleModel,
  AggregationBookModel,
  AggregationChapterModel,
  CanonicalBibleModel,
  CanonicalBookModel,
  CanonicalVerseModel,
  DimCampaignModel,
  LlmVerseResultModel,
  ModelModel,
} from "@/lib/models";
import { getScoreThresholds, type ScoreThresholds } from "@/lib/score-thresholds";

type ExplorerLevel = "campaign" | "bible" | "book" | "chapter" | "verse";

type BreadcrumbItem = {
  level: ExplorerLevel;
  id: string | number | null;
  label: string;
};

type SummaryStats = {
  totalVerses: number;
  matchCount: number;
  avgFidelity: number;
  perfectRate: number;
  modelCount: number;
  lastEvaluated: string | null;
};

type ModelOption = {
  modelId: number;
  displayName: string;
  provider: string;
};

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const campaignTag = searchParams.get("campaignTag");
    const modelId = searchParams.get("modelId");
    const bibleId = searchParams.get("bibleId");
    const bookId = searchParams.get("bookId");
    const chapterId = searchParams.get("chapterId");

    // Fetch score thresholds from config
    const thresholds = await getScoreThresholds();

    // campaignTag is required
    if (!campaignTag) {
      // Return list of campaigns if no campaignTag
      const campaigns = await DimCampaignModel.find({ isVisible: true })
        .sort({ campaignStartDate: -1 })
        .lean();

      return NextResponse.json({
        ok: true,
        data: {
          level: "campaign" as ExplorerLevel,
          campaigns: campaigns.map((c) => ({
            campaignId: c.campaignId,
            campaignTag: c.campaignTag,
            campaignName: c.campaignName,
            campaignDescription: c.campaignDescription,
            campaignStartDate: c.campaignStartDate,
            campaignEndDate: c.campaignEndDate,
            isActive: c.isActive,
            isApproved: c.isApproved,
          })),
          breadcrumb: [],
          summary: null,
          models: [],
          thresholds,
        },
      });
    }

    // Get campaign info for breadcrumb
    const campaign = await DimCampaignModel.findOne({ campaignTag }).lean();
    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: `Campaign not found: ${campaignTag}` },
        { status: 404 }
      );
    }

    // Get available models for this campaign
    const availableModels = await getAvailableModels(campaignTag);

    // Build base filter
    const baseFilter: Record<string, unknown> = { campaignTag };
    if (modelId) {
      baseFilter.modelId = Number(modelId);
    }

    // Determine drill-down level and fetch appropriate data
    if (chapterId && bookId && bibleId) {
      // Verse level - full comparison data
      return await getVerseLevel(
        campaignTag,
        Number(bibleId),
        Number(bookId),
        Number(chapterId),
        modelId ? Number(modelId) : null,
        campaign,
        availableModels,
        thresholds
      );
    } else if (bookId && bibleId) {
      // Chapter level
      return await getChapterLevel(
        campaignTag,
        Number(bibleId),
        Number(bookId),
        modelId ? Number(modelId) : null,
        campaign,
        availableModels,
        thresholds
      );
    } else if (bibleId) {
      // Book level
      return await getBookLevel(
        campaignTag,
        Number(bibleId),
        modelId ? Number(modelId) : null,
        campaign,
        availableModels,
        thresholds
      );
    } else {
      // Bible level (top of campaign)
      return await getBibleLevel(
        campaignTag,
        modelId ? Number(modelId) : null,
        campaign,
        availableModels,
        thresholds
      );
    }
  } catch (error) {
    console.error("[Explorer API] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function getAvailableModels(campaignTag: string): Promise<ModelOption[]> {
  // Get distinct modelIds from aggregations for this campaign
  const modelIds = await AggregationBibleModel.distinct("modelId", {
    campaignTag,
  });

  if (modelIds.length === 0) {
    return [];
  }

  const models = await ModelModel.find({ modelId: { $in: modelIds } })
    .select("modelId displayName provider")
    .lean();

  return models.map((m) => ({
    modelId: m.modelId,
    displayName: m.displayName,
    provider: m.provider,
  }));
}

async function getBibleLevel(
  campaignTag: string,
  modelId: number | null,
  campaign: { campaignTag: string; campaignName: string },
  availableModels: ModelOption[],
  thresholds: ScoreThresholds
) {
  const filter: Record<string, unknown> = { campaignTag };
  if (modelId) {
    filter.modelId = modelId;
  }

  // Get bible-level aggregations
  const aggregations = await AggregationBibleModel.find(filter)
    .sort({ bibleId: 1 })
    .lean();

  // Get bible names
  const bibleIds = [...new Set(aggregations.map((a) => a.bibleId))];
  const bibles = await CanonicalBibleModel.find({ bibleId: { $in: bibleIds } })
    .select("bibleId name")
    .lean();
  const bibleMap = new Map(bibles.map((b) => [b.bibleId, b.name]));

  // Get model names
  const modelIds = [...new Set(aggregations.map((a) => a.modelId))];
  const models = await ModelModel.find({ modelId: { $in: modelIds } })
    .select("modelId displayName")
    .lean();
  const modelMap = new Map(models.map((m) => [m.modelId, m.displayName]));

  // Compute summary stats
  const summary = computeSummaryFromAggregations(aggregations);

  // Group by bible if no model filter, otherwise flat list
  const items = aggregations.map((agg) => ({
    bibleId: agg.bibleId,
    bibleName: bibleMap.get(agg.bibleId) ?? `Bible ${agg.bibleId}`,
    modelId: agg.modelId,
    modelName: modelMap.get(agg.modelId) ?? `Model ${agg.modelId}`,
    avgFidelity: agg.avgFidelity,
    perfectRate: agg.perfectRate,
    bookCount: agg.bookCount,
    chapterCount: agg.chapterCount,
    verseCount: agg.verseCount,
    matchCount: agg.matchCount,
    evaluatedAt: agg.evaluatedAt,
  }));

  const breadcrumb: BreadcrumbItem[] = [
    {
      level: "campaign",
      id: campaignTag,
      label: campaign.campaignName,
    },
  ];

  return NextResponse.json({
    ok: true,
    data: {
      level: "bible" as ExplorerLevel,
      campaignTag,
      campaignName: campaign.campaignName,
      items,
      breadcrumb,
      summary,
      models: availableModels,
      selectedModelId: modelId,
      thresholds,
    },
  });
}

async function getBookLevel(
  campaignTag: string,
  bibleId: number,
  modelId: number | null,
  campaign: { campaignTag: string; campaignName: string },
  availableModels: ModelOption[],
  thresholds: ScoreThresholds
) {
  const filter: Record<string, unknown> = { campaignTag, bibleId };
  if (modelId) {
    filter.modelId = modelId;
  }

  // Get book-level aggregations
  const aggregations = await AggregationBookModel.find(filter)
    .sort({ bookId: 1 })
    .lean();

  // Get book names
  const bookIds = [...new Set(aggregations.map((a) => a.bookId))];
  const books = await CanonicalBookModel.find({ bookId: { $in: bookIds } })
    .select("bookId bookName bookIndex")
    .lean();
  const bookMap = new Map(
    books.map((b) => [b.bookId, { name: b.bookName, index: b.bookIndex }])
  );

  // Get bible name
  const bible = await CanonicalBibleModel.findOne({ bibleId })
    .select("name")
    .lean();

  // Get model names
  const modelIds = [...new Set(aggregations.map((a) => a.modelId))];
  const models = await ModelModel.find({ modelId: { $in: modelIds } })
    .select("modelId displayName")
    .lean();
  const modelMap = new Map(models.map((m) => [m.modelId, m.displayName]));

  // Compute summary stats
  const summary = computeSummaryFromAggregations(aggregations);

  const items = aggregations
    .map((agg) => ({
      bookId: agg.bookId,
      bookName: bookMap.get(agg.bookId)?.name ?? `Book ${agg.bookId}`,
      bookIndex: bookMap.get(agg.bookId)?.index ?? 0,
      modelId: agg.modelId,
      modelName: modelMap.get(agg.modelId) ?? `Model ${agg.modelId}`,
      avgFidelity: agg.avgFidelity,
      perfectRate: agg.perfectRate,
      chapterCount: agg.chapterCount,
      verseCount: agg.verseCount,
      matchCount: agg.matchCount,
      evaluatedAt: agg.evaluatedAt,
    }))
    .sort((a, b) => a.bookIndex - b.bookIndex);

  const breadcrumb: BreadcrumbItem[] = [
    {
      level: "campaign",
      id: campaignTag,
      label: campaign.campaignName,
    },
    {
      level: "bible",
      id: bibleId,
      label: bible?.name ?? `Bible ${bibleId}`,
    },
  ];

  return NextResponse.json({
    ok: true,
    data: {
      level: "book" as ExplorerLevel,
      campaignTag,
      bibleId,
      bibleName: bible?.name ?? `Bible ${bibleId}`,
      items,
      breadcrumb,
      summary,
      models: availableModels,
      selectedModelId: modelId,
      thresholds,
    },
  });
}

async function getChapterLevel(
  campaignTag: string,
  bibleId: number,
  bookId: number,
  modelId: number | null,
  campaign: { campaignTag: string; campaignName: string },
  availableModels: ModelOption[],
  thresholds: ScoreThresholds
) {
  const filter: Record<string, unknown> = { campaignTag, bibleId, bookId };
  if (modelId) {
    filter.modelId = modelId;
  }

  // Get chapter-level aggregations
  const aggregations = await AggregationChapterModel.find(filter)
    .sort({ chapterId: 1 })
    .lean();

  // Get model names
  const modelIds = [...new Set(aggregations.map((a) => a.modelId))];
  const models = await ModelModel.find({ modelId: { $in: modelIds } })
    .select("modelId displayName")
    .lean();
  const modelMap = new Map(models.map((m) => [m.modelId, m.displayName]));

  // Get bible and book names
  const bible = await CanonicalBibleModel.findOne({ bibleId })
    .select("name")
    .lean();
  const book = await CanonicalBookModel.findOne({ bookId })
    .select("bookName")
    .lean();

  // Compute summary stats
  const summary = computeSummaryFromAggregations(aggregations);

  const items = aggregations.map((agg) => {
    // Extract chapter number from chapterId (last 3 digits typically)
    const chapterNumber = agg.chapterId % 1000;
    return {
      chapterId: agg.chapterId,
      chapterNumber,
      modelId: agg.modelId,
      modelName: modelMap.get(agg.modelId) ?? `Model ${agg.modelId}`,
      avgFidelity: agg.avgFidelity,
      perfectRate: agg.perfectRate,
      verseCount: agg.verseCount,
      matchCount: agg.matchCount,
      evaluatedAt: agg.evaluatedAt,
    };
  });

  const breadcrumb: BreadcrumbItem[] = [
    {
      level: "campaign",
      id: campaignTag,
      label: campaign.campaignName,
    },
    {
      level: "bible",
      id: bibleId,
      label: bible?.name ?? `Bible ${bibleId}`,
    },
    {
      level: "book",
      id: bookId,
      label: book?.bookName ?? `Book ${bookId}`,
    },
  ];

  return NextResponse.json({
    ok: true,
    data: {
      level: "chapter" as ExplorerLevel,
      campaignTag,
      bibleId,
      bookId,
      bookName: book?.bookName ?? `Book ${bookId}`,
      items,
      breadcrumb,
      summary,
      models: availableModels,
      selectedModelId: modelId,
      thresholds,
    },
  });
}

async function getVerseLevel(
  campaignTag: string,
  bibleId: number,
  bookId: number,
  chapterId: number,
  modelId: number | null,
  campaign: { campaignTag: string; campaignName: string },
  availableModels: ModelOption[],
  thresholds: ScoreThresholds
) {
  const filter: Record<string, unknown> = { campaignTag, chapterId };
  if (modelId) {
    filter.modelId = modelId;
  }

  // Get verse results
  const verseResults = await LlmVerseResultModel.find(filter)
    .sort({ verseId: 1, modelId: 1 })
    .lean();

  // Get canonical verses for this chapter
  const canonicalVerses = await CanonicalVerseModel.find({ chapterId })
    .select("verseId verseNumber reference textProcessed")
    .sort({ verseNumber: 1 })
    .lean();

  const canonicalMap = new Map(
    canonicalVerses.map((v) => [
      v.verseId,
      {
        verseNumber: v.verseNumber,
        reference: v.reference,
        canonicalText: v.textProcessed,
      },
    ])
  );

  // Get model names
  const modelIds = [...new Set(verseResults.map((r) => r.modelId))];
  const models = await ModelModel.find({ modelId: { $in: modelIds } })
    .select("modelId displayName")
    .lean();
  const modelMap = new Map(models.map((m) => [m.modelId, m.displayName]));

  // Get bible and book names
  const bible = await CanonicalBibleModel.findOne({ bibleId })
    .select("name")
    .lean();
  const book = await CanonicalBookModel.findOne({ bookId })
    .select("bookName")
    .lean();

  // Build comparison items
  const items = verseResults.map((result) => {
    const canonical = canonicalMap.get(result.verseId);
    return {
      verseId: result.verseId,
      verseNumber: canonical?.verseNumber ?? result.verseId % 1000,
      reference: canonical?.reference ?? `Verse ${result.verseId}`,
      modelId: result.modelId,
      modelName: modelMap.get(result.modelId) ?? `Model ${result.modelId}`,
      canonicalText: canonical?.canonicalText ?? "",
      llmText: result.responseProcessed,
      hashMatch: result.hashMatch,
      fidelityScore: result.fidelityScore,
      diff: result.diff,
      latencyMs: result.latencyMs,
      evaluatedAt: result.evaluatedAt,
    };
  });

  // Compute summary
  const summary: SummaryStats = {
    totalVerses: items.length,
    matchCount: items.filter((i) => i.hashMatch).length,
    avgFidelity:
      items.length > 0
        ? Math.round(
            (items.reduce((sum, i) => sum + i.fidelityScore, 0) / items.length) *
              100
          ) / 100
        : 0,
    perfectRate:
      items.length > 0
        ? Math.round(
            (items.filter((i) => i.hashMatch).length / items.length) * 10000
          ) / 10000
        : 0,
    modelCount: modelIds.length,
    lastEvaluated:
      items.length > 0
        ? new Date(
            Math.max(...items.map((i) => new Date(i.evaluatedAt).getTime()))
          ).toISOString()
        : null,
  };

  // Extract chapter number
  const chapterNumber = chapterId % 1000;

  const breadcrumb: BreadcrumbItem[] = [
    {
      level: "campaign",
      id: campaignTag,
      label: campaign.campaignName,
    },
    {
      level: "bible",
      id: bibleId,
      label: bible?.name ?? `Bible ${bibleId}`,
    },
    {
      level: "book",
      id: bookId,
      label: book?.bookName ?? `Book ${bookId}`,
    },
    {
      level: "chapter",
      id: chapterId,
      label: `Chapter ${chapterNumber}`,
    },
  ];

  return NextResponse.json({
    ok: true,
    data: {
      level: "verse" as ExplorerLevel,
      campaignTag,
      bibleId,
      bookId,
      chapterId,
      chapterNumber,
      items,
      breadcrumb,
      summary,
      models: availableModels,
      selectedModelId: modelId,
      thresholds,
    },
  });
}

function computeSummaryFromAggregations(
  aggregations: Array<{
    verseCount: number;
    matchCount: number;
    avgFidelity: number;
    perfectRate: number;
    modelId: number;
    evaluatedAt: Date;
  }>
): SummaryStats {
  if (aggregations.length === 0) {
    return {
      totalVerses: 0,
      matchCount: 0,
      avgFidelity: 0,
      perfectRate: 0,
      modelCount: 0,
      lastEvaluated: null,
    };
  }

  const totalVerses = aggregations.reduce((sum, a) => sum + a.verseCount, 0);
  const matchCount = aggregations.reduce((sum, a) => sum + a.matchCount, 0);
  const avgFidelity =
    Math.round(
      (aggregations.reduce((sum, a) => sum + a.avgFidelity, 0) /
        aggregations.length) *
        100
    ) / 100;
  const perfectRate = totalVerses > 0 ? matchCount / totalVerses : 0;
  const modelCount = new Set(aggregations.map((a) => a.modelId)).size;
  const lastEvaluated = new Date(
    Math.max(...aggregations.map((a) => new Date(a.evaluatedAt).getTime()))
  ).toISOString();

  return {
    totalVerses,
    matchCount,
    avgFidelity,
    perfectRate,
    modelCount,
    lastEvaluated,
  };
}
