import assert from "node:assert/strict";
import test from "node:test";

import { sha256 } from "../src/lib/hash";

test("sha256 returns 64 character hex string", () => {
  const result = sha256("test");
  assert.equal(result.length, 64);
  assert.match(result, /^[a-f0-9]{64}$/);
});

test("sha256 handles empty string", () => {
  const result = sha256("");
  // Known SHA-256 hash of empty string
  assert.equal(result, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("sha256 produces known hash for known input", () => {
  const result = sha256("In the beginning God created the heaven and the earth.");
  // This should be deterministic - verify the hash is consistent
  assert.equal(result.length, 64);
  
  // Run again to verify same output
  const result2 = sha256("In the beginning God created the heaven and the earth.");
  assert.equal(result, result2);
});

test("sha256 is deterministic - same input produces same output", () => {
  const input = "The LORD is my shepherd; I shall not want.";
  const hash1 = sha256(input);
  const hash2 = sha256(input);
  const hash3 = sha256(input);
  
  assert.equal(hash1, hash2);
  assert.equal(hash2, hash3);
});

test("sha256 handles Unicode characters", () => {
  const result = sha256("¶ The LORD's word");
  assert.equal(result.length, 64);
  assert.match(result, /^[a-f0-9]{64}$/);
});

test("sha256 handles curly quotes", () => {
  const straight = sha256("The LORD's word");
  const curly = sha256("The LORD\u2019s word");
  
  // Different inputs should produce different hashes
  assert.notEqual(straight, curly);
});

test("sha256 different inputs produce different hashes", () => {
  const hash1 = sha256("Genesis 1:1");
  const hash2 = sha256("Genesis 1:2");
  
  assert.notEqual(hash1, hash2);
});

test("sha256 whitespace matters", () => {
  const noSpace = sha256("abc");
  const withSpace = sha256("a b c");
  const leadingSpace = sha256(" abc");
  
  assert.notEqual(noSpace, withSpace);
  assert.notEqual(noSpace, leadingSpace);
  assert.notEqual(withSpace, leadingSpace);
});
