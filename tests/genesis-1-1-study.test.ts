/**
 * Genesis 1:1 Transform & Hash Comparison Study
 *
 * This test harness compares canonical verse text against LLM responses
 * using the transform profiles from MongoDB (no hardcoded state).
 */

import assert from "node:assert";
import { after, before, describe, it } from "node:test";

import mongoose from "mongoose";

import { sha256 } from "../src/lib/hash";
import { applyTransformProfile, type TransformProfile } from "../src/lib/transforms";
import { compareText } from "../src/lib/evaluation";
import { CanonicalVerseModel, TransformProfileModel } from "../src/lib/models";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME ?? "bible-bench";

type CanonicalVerseSnapshot = {
  verseId: number;
  reference: string;
  textRaw: string;
  textProcessed: string;
  hashRaw: string;
  hashProcessed: string;
};

let canonicalVerse: CanonicalVerseSnapshot;
let canonicalProfile: TransformProfile;
let modelProfile: TransformProfile;

// ============================================================================
// SIMULATED LLM RESPONSES
// ============================================================================

const LLM_RESPONSES = {
  // Actual response from ChatGPT (as reported by user)
  chatgpt_actual: `"In the beginning God created the heaven and the earth."`,
  // Without quotes
  chatgpt_clean: `In the beginning God created the heaven and the earth.`,
  // If model included verse number
  with_verse_number: `1 In the beginning God created the heaven and the earth.`,
  // If model included verse number without space
  with_verse_number_no_space: `1In the beginning God created the heaven and the earth.`,
  // If model already returns bracketed verse number
  with_bracketed_number: `[1] In the beginning God created the heaven and the earth.`,
};

describe("Genesis 1:1 Transform Study", () => {
  before(async () => {
    assert.ok(MONGODB_URI, "MONGODB_URI must be set in .env.local");
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DBNAME });

    const verseDoc = await CanonicalVerseModel.findOne({ verseId: 1001001 }).lean();
    assert.ok(verseDoc, "Canonical verse 1001001 (Genesis 1:1) not found");
    canonicalVerse = {
      verseId: verseDoc.verseId,
      reference: verseDoc.reference,
      textRaw: verseDoc.textRaw,
      textProcessed: verseDoc.textProcessed,
      hashRaw: verseDoc.hashRaw,
      hashProcessed: verseDoc.hashProcessed,
    };

    const canonicalProfileDoc = await TransformProfileModel.findOne({
      profileId: 1,
      scope: "canonical",
      isActive: true,
    }).lean();
    assert.ok(canonicalProfileDoc, "Canonical transform profile (profileId=1) not found");
    canonicalProfile = canonicalProfileDoc as TransformProfile;

    const modelProfileDoc = await TransformProfileModel.findOne({
      profileId: 2,
      scope: "model_output",
      isActive: true,
    }).lean();
    assert.ok(modelProfileDoc, "Model output transform profile (profileId=2) not found");
    modelProfile = modelProfileDoc as TransformProfile;
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it("should verify canonical hash computation", () => {
    console.log("\n=== CANONICAL HASH VERIFICATION ===");
    console.log(`textRaw:       "${canonicalVerse.textRaw}"`);
    console.log(`textProcessed: "${canonicalVerse.textProcessed}"`);

    const computedHashRaw = sha256(canonicalVerse.textRaw);
    const computedHashProcessed = sha256(canonicalVerse.textProcessed);

    console.log(`\nHash (raw):       ${computedHashRaw}`);
    console.log(`Expected (raw):   ${canonicalVerse.hashRaw}`);
    console.log(`Match: ${computedHashRaw === canonicalVerse.hashRaw}`);

    console.log(`\nHash (processed): ${computedHashProcessed}`);
    console.log(`Expected (proc):  ${canonicalVerse.hashProcessed}`);
    console.log(`Match: ${computedHashProcessed === canonicalVerse.hashProcessed}`);

    assert.strictEqual(computedHashRaw, canonicalVerse.hashRaw, "Raw hash should match");
    assert.strictEqual(computedHashProcessed, canonicalVerse.hashProcessed, "Processed hash should match");
  });

  it("should show canonical profile formats verse numbers as brackets", () => {
    console.log("\n=== CANONICAL PROFILE ANALYSIS ===");
    console.log(`Steps in ${canonicalProfile.name}:`);
    canonicalProfile.steps.forEach((step) => {
      console.log(`  ${step.order}. ${step.type} (enabled: ${step.enabled})`);
    });

    const hasRegexReplace = canonicalProfile.steps.some((s) => s.type === "regexReplace");
    const hasReplaceMap = canonicalProfile.steps.some((s) => s.type === "replaceMap");

    console.log(`\nHas regexReplace step: ${hasRegexReplace}`);
    console.log(`Has replaceMap step: ${hasReplaceMap}`);
    console.log(`Canonical textProcessed: "${canonicalVerse.textProcessed}"`);

    assert.ok(hasRegexReplace, "Canonical profile should format verse numbers with regexReplace");
    assert.ok(hasReplaceMap, "Canonical profile should normalize Unicode characters");
    assert.ok(
      canonicalVerse.textProcessed.startsWith("[1] "),
      "Canonical textProcessed should be bracketed"
    );
  });

  it("should show model output profile includes bracket formatting step", () => {
    console.log("\n=== MODEL OUTPUT PROFILE ANALYSIS ===");
    console.log(`Steps in ${modelProfile.name}:`);
    modelProfile.steps.forEach((step) => {
      console.log(`  ${step.order}. ${step.type} (enabled: ${step.enabled})`);
    });

    const hasRegexReplace = modelProfile.steps.some((s) => s.type === "regexReplace");
    const hasReplaceMap = modelProfile.steps.some((s) => s.type === "replaceMap");

    console.log(`\nHas regexReplace step: ${hasRegexReplace}`);
    console.log(`Has replaceMap step: ${hasReplaceMap}`);

    assert.ok(hasRegexReplace, "Model output profile should format verse numbers with regexReplace");
    assert.ok(hasReplaceMap, "Model output profile should normalize Unicode characters");
  });

  it("should compare ChatGPT actual response (with quotes)", () => {
    console.log("\n=== CHATGPT ACTUAL RESPONSE (with quotes) ===");
    const responseRaw = LLM_RESPONSES.chatgpt_actual;
    console.log(`Response raw: ${responseRaw}`);

    const responseProcessed = applyTransformProfile(responseRaw, modelProfile);
    console.log(`After ${modelProfile.name}: "${responseProcessed}"`);

    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${canonicalVerse.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === canonicalVerse.hashProcessed}`);

    const { fidelityScore, diff } = compareText(canonicalVerse.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);

    console.log(`\nCanonical:  "${canonicalVerse.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should compare ChatGPT clean response (no quotes)", () => {
    console.log("\n=== CHATGPT CLEAN RESPONSE (no quotes) ===");
    const responseRaw = LLM_RESPONSES.chatgpt_clean;
    console.log(`Response raw: ${responseRaw}`);

    const responseProcessed = applyTransformProfile(responseRaw, modelProfile);
    console.log(`After ${modelProfile.name}: "${responseProcessed}"`);

    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${canonicalVerse.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === canonicalVerse.hashProcessed}`);

    const { fidelityScore, diff } = compareText(canonicalVerse.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);

    console.log(`\nCanonical:  "${canonicalVerse.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should compare response WITH verse number (space)", () => {
    console.log("\n=== RESPONSE WITH VERSE NUMBER (with space) ===");
    const responseRaw = LLM_RESPONSES.with_verse_number;
    console.log(`Response raw: "${responseRaw}"`);

    const responseProcessed = applyTransformProfile(responseRaw, modelProfile);
    console.log(`After ${modelProfile.name}: "${responseProcessed}"`);

    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${canonicalVerse.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === canonicalVerse.hashProcessed}`);

    const { fidelityScore, diff } = compareText(canonicalVerse.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);

    console.log(`\nCanonical:  "${canonicalVerse.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should compare response WITH verse number (no space)", () => {
    console.log("\n=== RESPONSE WITH VERSE NUMBER (no space) ===");
    const responseRaw = LLM_RESPONSES.with_verse_number_no_space;
    console.log(`Response raw: "${responseRaw}"`);

    const responseProcessed = applyTransformProfile(responseRaw, modelProfile);
    console.log(`After ${modelProfile.name}: "${responseProcessed}"`);

    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${canonicalVerse.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === canonicalVerse.hashProcessed}`);

    const { fidelityScore, diff } = compareText(canonicalVerse.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);

    console.log(`\nCanonical:  "${canonicalVerse.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should compare response WITH bracketed verse number", () => {
    console.log("\n=== RESPONSE WITH BRACKETED VERSE NUMBER ===");
    const responseRaw = LLM_RESPONSES.with_bracketed_number;
    console.log(`Response raw: "${responseRaw}"`);

    const responseProcessed = applyTransformProfile(responseRaw, modelProfile);
    console.log(`After ${modelProfile.name}: "${responseProcessed}"`);

    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${canonicalVerse.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === canonicalVerse.hashProcessed}`);

    const { fidelityScore, diff } = compareText(canonicalVerse.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);

    console.log(`\nCanonical:  "${canonicalVerse.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });
});
