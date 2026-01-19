type ResultEntry = {
  hashMatch: boolean;
  fidelityScore: number;
};

type ResultSummary = {
  total: number;
  matches: number;
  perfectRate: number;
  avgFidelity: number;
};

export function summarizeResults(results: ResultEntry[]): ResultSummary {
  if (results.length === 0) {
    return { total: 0, matches: 0, perfectRate: 0, avgFidelity: 0 };
  }

  const total = results.length;
  const matches = results.reduce(
    (count, result) => (result.hashMatch ? count + 1 : count),
    0
  );
  const fidelitySum = results.reduce((sum, result) => sum + result.fidelityScore, 0);
  const perfectRate = Number((matches / total).toFixed(4));
  const avgFidelity = Number((fidelitySum / total).toFixed(2));

  return { total, matches, perfectRate, avgFidelity };
}

export type { ResultSummary };
