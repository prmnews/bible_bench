/**
 * Aggregation Module
 *
 * Computes and stores materialized aggregates at chapter, book, and bible levels
 * from verse-level results. Uses bulk aggregation with $out for atomic replacement.
 *
 * Dimension grains (includes campaignTag for trend analysis):
 * - aggregationChapters: (campaignTag, modelId, bibleId, bookId, chapterId)
 * - aggregationBooks: (campaignTag, modelId, bibleId, bookId)
 * - aggregationBibles: (campaignTag, modelId, bibleId)
 */

import mongoose from "mongoose";

import { LlmVerseResultModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type AggregationResult = {
  chaptersProcessed: number;
  booksProcessed: number;
  biblesProcessed: number;
  errors: string[];
};

/**
 * Compute chapter-level aggregates from all llmVerseResults.
 * Uses $out to atomically replace the aggregationChapters collection.
 */
async function computeChapterAggregatesBulk(): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized");
  }

  // Pipeline: group by dimension grain, compute metrics, output to collection
  const pipeline = [
    {
      $group: {
        _id: {
          campaignTag: "$campaignTag",
          modelId: "$modelId",
          bibleId: "$bibleId",
          bookId: "$bookId",
          chapterId: "$chapterId",
        },
        avgFidelity: { $avg: "$fidelityScore" },
        verseCount: { $sum: 1 },
        matchCount: { $sum: { $cond: ["$hashMatch", 1, 0] } },
        evaluatedAt: { $max: "$evaluatedAt" },
      },
    },
    {
      $project: {
        _id: 0,
        campaignTag: "$_id.campaignTag",
        modelId: "$_id.modelId",
        bibleId: "$_id.bibleId",
        bookId: "$_id.bookId",
        chapterId: "$_id.chapterId",
        avgFidelity: { $round: ["$avgFidelity", 2] },
        perfectRate: {
          $round: [{ $divide: ["$matchCount", "$verseCount"] }, 4],
        },
        verseCount: 1,
        matchCount: 1,
        evaluatedAt: 1,
      },
    },
    {
      $out: "aggregationChapters",
    },
  ];

  await LlmVerseResultModel.aggregate(pipeline);

  // Count documents in the output collection
  const count = await db.collection("aggregationChapters").countDocuments();
  return count;
}

/**
 * Compute book-level aggregates from aggregationChapters.
 * Uses $out to atomically replace the aggregationBooks collection.
 */
async function computeBookAggregatesBulk(): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized");
  }

  // Pipeline: group chapters by book, compute metrics, output to collection
  const pipeline = [
    {
      $group: {
        _id: {
          campaignTag: "$campaignTag",
          modelId: "$modelId",
          bibleId: "$bibleId",
          bookId: "$bookId",
        },
        avgFidelity: { $avg: "$avgFidelity" },
        chapterCount: { $sum: 1 },
        verseCount: { $sum: "$verseCount" },
        matchCount: { $sum: "$matchCount" },
        evaluatedAt: { $max: "$evaluatedAt" },
      },
    },
    {
      $project: {
        _id: 0,
        campaignTag: "$_id.campaignTag",
        modelId: "$_id.modelId",
        bibleId: "$_id.bibleId",
        bookId: "$_id.bookId",
        avgFidelity: { $round: ["$avgFidelity", 2] },
        perfectRate: {
          $round: [{ $divide: ["$matchCount", "$verseCount"] }, 4],
        },
        chapterCount: 1,
        verseCount: 1,
        matchCount: 1,
        evaluatedAt: 1,
      },
    },
    {
      $out: "aggregationBooks",
    },
  ];

  // Read from fresh aggregationChapters
  await db.collection("aggregationChapters").aggregate(pipeline).toArray();

  // Count documents in the output collection
  const count = await db.collection("aggregationBooks").countDocuments();
  return count;
}

/**
 * Compute bible-level aggregates from aggregationBooks.
 * Uses $out to atomically replace the aggregationBibles collection.
 */
async function computeBibleAggregatesBulk(): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized");
  }

  // Pipeline: group books by bible, compute metrics, output to collection
  const pipeline = [
    {
      $group: {
        _id: {
          campaignTag: "$campaignTag",
          modelId: "$modelId",
          bibleId: "$bibleId",
        },
        avgFidelity: { $avg: "$avgFidelity" },
        bookCount: { $sum: 1 },
        chapterCount: { $sum: "$chapterCount" },
        verseCount: { $sum: "$verseCount" },
        matchCount: { $sum: "$matchCount" },
        evaluatedAt: { $max: "$evaluatedAt" },
      },
    },
    {
      $project: {
        _id: 0,
        campaignTag: "$_id.campaignTag",
        modelId: "$_id.modelId",
        bibleId: "$_id.bibleId",
        avgFidelity: { $round: ["$avgFidelity", 2] },
        perfectRate: {
          $round: [{ $divide: ["$matchCount", "$verseCount"] }, 4],
        },
        bookCount: 1,
        chapterCount: 1,
        verseCount: 1,
        matchCount: 1,
        evaluatedAt: 1,
      },
    },
    {
      $out: "aggregationBibles",
    },
  ];

  // Read from fresh aggregationBooks
  await db.collection("aggregationBooks").aggregate(pipeline).toArray();

  // Count documents in the output collection
  const count = await db.collection("aggregationBibles").countDocuments();
  return count;
}

/**
 * Recompute all aggregates from llmVerseResults using bulk $out operations.
 * This is idempotent and self-healing - completely replaces all aggregation collections.
 *
 * Order of operations:
 * 1. Chapters (from llmVerseResults)
 * 2. Books (from aggregationChapters)
 * 3. Bibles (from aggregationBooks)
 */
export async function recomputeAllAggregatesBulk(): Promise<AggregationResult> {
  await connectToDatabase();

  const errors: string[] = [];
  let chaptersProcessed = 0;
  let booksProcessed = 0;
  let biblesProcessed = 0;

  // Step 1: Chapters (source: llmVerseResults)
  try {
    chaptersProcessed = await computeChapterAggregatesBulk();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Chapter aggregation failed: ${message}`);
  }

  // Step 2: Books (source: aggregationChapters)
  try {
    booksProcessed = await computeBookAggregatesBulk();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Book aggregation failed: ${message}`);
  }

  // Step 3: Bibles (source: aggregationBooks)
  try {
    biblesProcessed = await computeBibleAggregatesBulk();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Bible aggregation failed: ${message}`);
  }

  return {
    chaptersProcessed,
    booksProcessed,
    biblesProcessed,
    errors,
  };
}

export type { AggregationResult };
