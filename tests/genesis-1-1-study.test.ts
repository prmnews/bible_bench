/**
 * Genesis 1:1 Transform & Hash Comparison Study
 * 
 * This test harness explores how the canonical verse text compares
 * with LLM responses after applying transform profiles.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import { sha256 } from "../src/lib/hash";
import { applyTransformProfile, type TransformProfile } from "../src/lib/transforms";
import { compareText } from "../src/lib/evaluation";

// ============================================================================
// CANONICAL DATA (from verses collection)
// ============================================================================

const CANONICAL_VERSE = {
  verseId: 1001001,
  reference: "Genesis 1:1",
  textRaw: "1In the beginning God created the heaven and the earth. ",
  textProcessed: "1In the beginning God created the heaven and the earth.",
  hashRaw: "872a4f043b342336daa01346db430e8c94c20acffedb6a409b0dd5daca35a1fe",
  hashProcessed: "99cef2ae4f4b11e1d1edcc23767033779c7a35d5a7c59b42b8475e910f98b7df",
};

// ============================================================================
// TRANSFORM PROFILES (from transformProfiles collection)
// ============================================================================

const CANONICAL_PROFILE: TransformProfile = {
  profileId: 1,
  name: "KJV_CANONICAL_V1",
  scope: "canonical",
  version: 1,
  bibleId: 1001,
  isDefault: true,
  description: "Default canonical transform profile for KJV Bible text",
  steps: [
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: {
        tagNames: ["wj", "add", "verse-span", "para", "char", "verse", "chapter"],
      },
    },
    {
      order: 2,
      type: "stripParagraphMarkers",
      enabled: true,
      params: { markers: ["¶"] },
    },
    {
      order: 3,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
    {
      order: 4,
      type: "trim",
      enabled: true,
      params: {},
    },
  ],
  isActive: true,
};

const MODEL_OUTPUT_PROFILE: TransformProfile = {
  profileId: 2,
  name: "MODEL_OUTPUT_V1",
  scope: "model_output",
  version: 1,
  bibleId: 1001,
  isDefault: true,
  description: "Default transform profile for model output normalization",
  steps: [
    {
      order: 1,
      type: "stripVerseNumbers",
      enabled: true,
      params: { patterns: ["^\\d+\\s*"] },
    },
    {
      order: 2,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
    {
      order: 3,
      type: "trim",
      enabled: true,
      params: {},
    },
  ],
  isActive: true,
};

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
  
  // Perfect match to canonical textProcessed
  perfect_canonical: `1In the beginning God created the heaven and the earth.`,
};

// ============================================================================
// TESTS
// ============================================================================

describe("Genesis 1:1 Transform Study", () => {
  
  it("should verify canonical hash computation", () => {
    console.log("\n=== CANONICAL HASH VERIFICATION ===");
    console.log(`textRaw:       "${CANONICAL_VERSE.textRaw}"`);
    console.log(`textProcessed: "${CANONICAL_VERSE.textProcessed}"`);
    
    const computedHashRaw = sha256(CANONICAL_VERSE.textRaw);
    const computedHashProcessed = sha256(CANONICAL_VERSE.textProcessed);
    
    console.log(`\nHash (raw):       ${computedHashRaw}`);
    console.log(`Expected (raw):   ${CANONICAL_VERSE.hashRaw}`);
    console.log(`Match: ${computedHashRaw === CANONICAL_VERSE.hashRaw}`);
    
    console.log(`\nHash (processed): ${computedHashProcessed}`);
    console.log(`Expected (proc):  ${CANONICAL_VERSE.hashProcessed}`);
    console.log(`Match: ${computedHashProcessed === CANONICAL_VERSE.hashProcessed}`);
    
    assert.strictEqual(computedHashRaw, CANONICAL_VERSE.hashRaw, "Raw hash should match");
    assert.strictEqual(computedHashProcessed, CANONICAL_VERSE.hashProcessed, "Processed hash should match");
  });

  it("should show canonical profile does NOT strip verse numbers", () => {
    console.log("\n=== CANONICAL PROFILE ANALYSIS ===");
    console.log("Steps in KJV_CANONICAL_V1:");
    CANONICAL_PROFILE.steps.forEach((step) => {
      console.log(`  ${step.order}. ${step.type} (enabled: ${step.enabled})`);
    });
    
    const hasStripVerseNumbers = CANONICAL_PROFILE.steps.some(
      (s) => s.type === "stripVerseNumbers"
    );
    console.log(`\nHas stripVerseNumbers step: ${hasStripVerseNumbers}`);
    console.log("OBSERVATION: Verse number '1' is KEPT in canonical textProcessed");
    
    assert.strictEqual(hasStripVerseNumbers, false);
  });

  it("should show model output profile DOES strip verse numbers", () => {
    console.log("\n=== MODEL OUTPUT PROFILE ANALYSIS ===");
    console.log("Steps in MODEL_OUTPUT_V1:");
    MODEL_OUTPUT_PROFILE.steps.forEach((step) => {
      console.log(`  ${step.order}. ${step.type} (enabled: ${step.enabled})`);
      if (step.type === "stripVerseNumbers") {
        console.log(`     patterns: ${JSON.stringify(step.params["patterns"])}`);
      }
    });
    
    const stripStep = MODEL_OUTPUT_PROFILE.steps.find(
      (s) => s.type === "stripVerseNumbers"
    );
    console.log(`\nHas stripVerseNumbers step: ${!!stripStep}`);
    console.log("OBSERVATION: Verse numbers ARE stripped from model output");
    
    assert.ok(stripStep);
  });

  it("should compare ChatGPT actual response (with quotes)", () => {
    console.log("\n=== CHATGPT ACTUAL RESPONSE (with quotes) ===");
    const responseRaw = LLM_RESPONSES.chatgpt_actual;
    console.log(`Response raw: ${responseRaw}`);
    
    const responseProcessed = applyTransformProfile(responseRaw, MODEL_OUTPUT_PROFILE);
    console.log(`After MODEL_OUTPUT_V1: "${responseProcessed}"`);
    
    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${CANONICAL_VERSE.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === CANONICAL_VERSE.hashProcessed}`);
    
    const { fidelityScore, diff } = compareText(CANONICAL_VERSE.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);
    
    console.log(`\nCanonical:  "${CANONICAL_VERSE.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should compare ChatGPT clean response (no quotes)", () => {
    console.log("\n=== CHATGPT CLEAN RESPONSE (no quotes) ===");
    const responseRaw = LLM_RESPONSES.chatgpt_clean;
    console.log(`Response raw: ${responseRaw}`);
    
    const responseProcessed = applyTransformProfile(responseRaw, MODEL_OUTPUT_PROFILE);
    console.log(`After MODEL_OUTPUT_V1: "${responseProcessed}"`);
    
    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${CANONICAL_VERSE.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === CANONICAL_VERSE.hashProcessed}`);
    
    const { fidelityScore, diff } = compareText(CANONICAL_VERSE.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);
    
    console.log(`\nCanonical:  "${CANONICAL_VERSE.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should compare response WITH verse number (space)", () => {
    console.log("\n=== RESPONSE WITH VERSE NUMBER (with space) ===");
    const responseRaw = LLM_RESPONSES.with_verse_number;
    console.log(`Response raw: "${responseRaw}"`);
    
    const responseProcessed = applyTransformProfile(responseRaw, MODEL_OUTPUT_PROFILE);
    console.log(`After MODEL_OUTPUT_V1: "${responseProcessed}"`);
    
    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${CANONICAL_VERSE.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === CANONICAL_VERSE.hashProcessed}`);
    
    const { fidelityScore, diff } = compareText(CANONICAL_VERSE.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);
    
    console.log(`\nCanonical:  "${CANONICAL_VERSE.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should compare response WITH verse number (no space)", () => {
    console.log("\n=== RESPONSE WITH VERSE NUMBER (no space) ===");
    const responseRaw = LLM_RESPONSES.with_verse_number_no_space;
    console.log(`Response raw: "${responseRaw}"`);
    
    const responseProcessed = applyTransformProfile(responseRaw, MODEL_OUTPUT_PROFILE);
    console.log(`After MODEL_OUTPUT_V1: "${responseProcessed}"`);
    
    const hashProcessed = sha256(responseProcessed);
    console.log(`\nHash (response): ${hashProcessed}`);
    console.log(`Hash (canonical): ${CANONICAL_VERSE.hashProcessed}`);
    console.log(`Hash match: ${hashProcessed === CANONICAL_VERSE.hashProcessed}`);
    
    const { fidelityScore, diff } = compareText(CANONICAL_VERSE.textProcessed, responseProcessed);
    console.log(`\nFidelity score: ${fidelityScore}%`);
    console.log(`Diff: ${JSON.stringify(diff)}`);
    
    console.log(`\nCanonical:  "${CANONICAL_VERSE.textProcessed}"`);
    console.log(`Response:   "${responseProcessed}"`);
  });

  it("should show the asymmetry problem", () => {
    console.log("\n=== THE ASYMMETRY PROBLEM ===");
    console.log("\n1. Canonical text stored in DB:");
    console.log(`   textProcessed: "${CANONICAL_VERSE.textProcessed}"`);
    console.log(`   Note: Verse number '1' is EMBEDDED at the start`);
    
    console.log("\n2. When model returns PERFECT text (without verse number):");
    const perfectResponse = "In the beginning God created the heaven and the earth.";
    const afterTransform = applyTransformProfile(perfectResponse, MODEL_OUTPUT_PROFILE);
    console.log(`   Model raw:       "${perfectResponse}"`);
    console.log(`   After transform: "${afterTransform}"`);
    
    console.log("\n3. Comparison:");
    console.log(`   Canonical: "${CANONICAL_VERSE.textProcessed}"`);
    console.log(`   Response:  "${afterTransform}"`);
    
    const { fidelityScore, diff } = compareText(CANONICAL_VERSE.textProcessed, afterTransform);
    console.log(`\n   Fidelity: ${fidelityScore}%`);
    console.log(`   Diff: ${JSON.stringify(diff)}`);
    
    console.log("\n4. THE PROBLEM:");
    console.log("   - Canonical has '1In the beginning...' (verse number kept)");
    console.log("   - Model output profile strips verse numbers");
    console.log("   - Even a PERFECT model response will never match!");
    console.log("   - The '1' in canonical is counted as an 'omission' from model output");
  });

  it("should demonstrate what would fix the asymmetry", () => {
    console.log("\n=== PROPOSED FIX: Normalize both the same way ===");
    
    // Option A: Strip verse numbers from BOTH
    const canonicalWithoutNumber = "In the beginning God created the heaven and the earth.";
    const modelResponse = "In the beginning God created the heaven and the earth.";
    
    console.log("\nOption A: Strip verse numbers from both");
    console.log(`  Canonical (normalized): "${canonicalWithoutNumber}"`);
    console.log(`  Model response:         "${modelResponse}"`);
    console.log(`  Hash match: ${sha256(canonicalWithoutNumber) === sha256(modelResponse)}`);
    
    // Option B: Keep verse numbers in BOTH
    const canonicalWithNumber = "1In the beginning God created the heaven and the earth.";
    const modelResponseWithNumber = "1In the beginning God created the heaven and the earth.";
    
    console.log("\nOption B: Keep verse numbers in both (require model to include them)");
    console.log(`  Canonical:       "${canonicalWithNumber}"`);
    console.log(`  Model response:  "${modelResponseWithNumber}"`);
    console.log(`  Hash match: ${sha256(canonicalWithNumber) === sha256(modelResponseWithNumber)}`);
    
    // Show what needs to change
    console.log("\n=== RECOMMENDATION ===");
    console.log("Option A is better: Strip verse numbers from canonical textProcessed");
    console.log("Reason: LLMs naturally recite text without verse numbers");
    console.log("Action: Add 'stripVerseNumbers' step to KJV_CANONICAL_V1 profile");
  });
});
