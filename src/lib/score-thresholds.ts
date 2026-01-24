import { AppConfigModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export type ScoreThresholds = {
  pass: number;
  warning: number;
  fail: number;
};

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  pass: 100,
  warning: 95,
  fail: 94,
};

/**
 * Fetches score thresholds from the database.
 * Falls back to default values if not found.
 */
export async function getScoreThresholds(): Promise<ScoreThresholds> {
  await connectToDatabase();

  const configs = await AppConfigModel.find(
    { key: { $in: ["SCORE_PASS", "SCORE_WARNING", "SCORE_FAIL"] } },
    { key: 1, value: 1 }
  ).lean();

  const configMap = new Map<string, string>();
  for (const config of configs) {
    configMap.set(config.key, config.value);
  }

  const parseValue = (key: string, defaultValue: number): number => {
    const value = configMap.get(key);
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  return {
    pass: parseValue("SCORE_PASS", DEFAULT_THRESHOLDS.pass),
    warning: parseValue("SCORE_WARNING", DEFAULT_THRESHOLDS.warning),
    fail: parseValue("SCORE_FAIL", DEFAULT_THRESHOLDS.fail),
  };
}

/**
 * Returns the score category based on thresholds.
 */
export function getScoreCategory(
  score: number,
  thresholds: ScoreThresholds
): "pass" | "warning" | "fail" {
  if (score >= thresholds.pass) return "pass";
  if (score >= thresholds.warning) return "warning";
  return "fail";
}
