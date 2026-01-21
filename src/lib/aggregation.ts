/**
 * Aggregation Module
 *
 * Computes and stores materialized aggregates at chapter, book, and bible levels
 * from verse-level results. This is called after run completion to pre-compute
 * dashboard metrics for fast reads.
 */

import {
  AggregationBibleModel,
  AggregationBookModel,
  AggregationChapterModel,
  LlmVerseResultModel,
  RunModel,
} from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type AggregationResult = {
  chaptersProcessed: number;
  booksProcessed: number;
  biblesProcessed: number;
  errors: string[];
};

/**
 * Compute and store chapter-level aggregates for a run.
 * Groups llmVerseResults by chapterId and computes metrics.
 */
export async function computeChapterAggregates(runId: string): Promise<number> {
  await connectToDatabase();

  // Get run to extract modelId and evaluatedAt
  const run = await RunModel.findOne({ runId }).lean();
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  const modelId = run.modelId as number;
  const evaluatedAt = (run.completedAt as Date) ?? (run.startedAt as Date);

  // Aggregate verse results by chapter
  const chapterAggregations = await LlmVerseResultModel.aggregate([
    { $match: { runId } },
    {
      $group: {
        _id: {
          chapterId: "$chapterId",
          bookId: "$bookId",
          bibleId: "$bibleId",
        },
        avgFidelity: { $avg: "$fidelityScore" },
        verseCount: { $sum: 1 },
        matchCount: { $sum: { $cond: ["$hashMatch", 1, 0] } },
      },
    },
  ]);

  // Store chapter aggregates
  for (const agg of chapterAggregations) {
    const perfectRate =
      agg.verseCount > 0 ? Number((agg.matchCount / agg.verseCount).toFixed(4)) : 0;

    await AggregationChapterModel.updateOne(
      {
        chapterId: agg._id.chapterId,
        modelId,
        runId,
      },
      {
        $set: {
          chapterId: agg._id.chapterId,
          modelId,
          bibleId: agg._id.bibleId,
          bookId: agg._id.bookId,
          runId,
          evaluatedAt,
          avgFidelity: Number(agg.avgFidelity.toFixed(2)),
          perfectRate,
          verseCount: agg.verseCount,
          matchCount: agg.matchCount,
        },
      },
      { upsert: true }
    );
  }

  return chapterAggregations.length;
}

/**
 * Compute and store book-level aggregates for a run.
 * Aggregates from chapter aggregates.
 */
export async function computeBookAggregates(runId: string): Promise<number> {
  await connectToDatabase();

  // Get run to extract modelId and evaluatedAt
  const run = await RunModel.findOne({ runId }).lean();
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  const modelId = run.modelId as number;
  const evaluatedAt = (run.completedAt as Date) ?? (run.startedAt as Date);

  // Aggregate from chapter aggregates
  const bookAggregations = await AggregationChapterModel.aggregate([
    { $match: { runId } },
    {
      $group: {
        _id: {
          bookId: "$bookId",
          bibleId: "$bibleId",
        },
        avgFidelity: { $avg: "$avgFidelity" },
        chapterCount: { $sum: 1 },
        verseCount: { $sum: "$verseCount" },
        matchCount: { $sum: "$matchCount" },
      },
    },
  ]);

  // Store book aggregates
  for (const agg of bookAggregations) {
    const perfectRate =
      agg.verseCount > 0 ? Number((agg.matchCount / agg.verseCount).toFixed(4)) : 0;

    await AggregationBookModel.updateOne(
      {
        bookId: agg._id.bookId,
        modelId,
        runId,
      },
      {
        $set: {
          bookId: agg._id.bookId,
          modelId,
          bibleId: agg._id.bibleId,
          runId,
          evaluatedAt,
          avgFidelity: Number(agg.avgFidelity.toFixed(2)),
          perfectRate,
          chapterCount: agg.chapterCount,
          verseCount: agg.verseCount,
          matchCount: agg.matchCount,
        },
      },
      { upsert: true }
    );
  }

  return bookAggregations.length;
}

/**
 * Compute and store bible-level aggregates for a run.
 * Aggregates from book aggregates.
 */
export async function computeBibleAggregates(runId: string): Promise<number> {
  await connectToDatabase();

  // Get run to extract modelId and evaluatedAt
  const run = await RunModel.findOne({ runId }).lean();
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  const modelId = run.modelId as number;
  const evaluatedAt = (run.completedAt as Date) ?? (run.startedAt as Date);

  // Aggregate from book aggregates
  const bibleAggregations = await AggregationBookModel.aggregate([
    { $match: { runId } },
    {
      $group: {
        _id: "$bibleId",
        avgFidelity: { $avg: "$avgFidelity" },
        bookCount: { $sum: 1 },
        chapterCount: { $sum: "$chapterCount" },
        verseCount: { $sum: "$verseCount" },
        matchCount: { $sum: "$matchCount" },
      },
    },
  ]);

  // Store bible aggregates
  for (const agg of bibleAggregations) {
    const perfectRate =
      agg.verseCount > 0 ? Number((agg.matchCount / agg.verseCount).toFixed(4)) : 0;

    await AggregationBibleModel.updateOne(
      {
        bibleId: agg._id,
        modelId,
        runId,
      },
      {
        $set: {
          bibleId: agg._id,
          modelId,
          runId,
          evaluatedAt,
          avgFidelity: Number(agg.avgFidelity.toFixed(2)),
          perfectRate,
          bookCount: agg.bookCount,
          chapterCount: agg.chapterCount,
          verseCount: agg.verseCount,
          matchCount: agg.matchCount,
        },
      },
      { upsert: true }
    );
  }

  return bibleAggregations.length;
}

/**
 * Compute all aggregates for a run (chapter → book → bible).
 * Call this after run completion.
 */
export async function computeAllAggregates(runId: string): Promise<AggregationResult> {
  const errors: string[] = [];
  let chaptersProcessed = 0;
  let booksProcessed = 0;
  let biblesProcessed = 0;

  try {
    chaptersProcessed = await computeChapterAggregates(runId);
  } catch (error) {
    errors.push(`Chapter aggregation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  try {
    booksProcessed = await computeBookAggregates(runId);
  } catch (error) {
    errors.push(`Book aggregation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  try {
    biblesProcessed = await computeBibleAggregates(runId);
  } catch (error) {
    errors.push(`Bible aggregation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  return {
    chaptersProcessed,
    booksProcessed,
    biblesProcessed,
    errors,
  };
}

export type { AggregationResult };
