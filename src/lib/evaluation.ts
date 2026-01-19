type DiffSummary = {
  substitutions: number;
  omissions: number;
  additions: number;
  transpositions: number;
};

type DiffStats = {
  distance: number;
  substitutions: number;
  omissions: number;
  additions: number;
};

function computeEditStats(source: string, target: string): DiffStats {
  const sourceLength = source.length;
  const targetLength = target.length;

  const dp: number[][] = Array.from({ length: sourceLength + 1 }, () =>
    Array.from({ length: targetLength + 1 }, () => 0)
  );

  for (let i = 0; i <= sourceLength; i += 1) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= targetLength; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= sourceLength; i += 1) {
    for (let j = 1; j <= targetLength; j += 1) {
      if (source[i - 1] === target[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        continue;
      }

      const substitute = dp[i - 1][j - 1] + 1;
      const remove = dp[i - 1][j] + 1;
      const insert = dp[i][j - 1] + 1;
      dp[i][j] = Math.min(substitute, remove, insert);
    }
  }

  let substitutions = 0;
  let omissions = 0;
  let additions = 0;

  let i = sourceLength;
  let j = targetLength;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && source[i - 1] === target[j - 1]) {
      if (dp[i][j] === dp[i - 1][j - 1]) {
        i -= 1;
        j -= 1;
        continue;
      }
    }

    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions += 1;
      i -= 1;
      j -= 1;
      continue;
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      omissions += 1;
      i -= 1;
      continue;
    }

    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      additions += 1;
      j -= 1;
      continue;
    }

    if (i > 0) {
      omissions += 1;
      i -= 1;
      continue;
    }

    additions += 1;
    j -= 1;
  }

  return {
    distance: dp[sourceLength][targetLength],
    substitutions,
    omissions,
    additions,
  };
}

export function compareText(canonical: string, candidate: string) {
  const stats = computeEditStats(canonical, candidate);
  const maxLength = Math.max(canonical.length, candidate.length);
  const ratio = maxLength === 0 ? 1 : Math.max(0, 1 - stats.distance / maxLength);
  const fidelityScore = Number((ratio * 100).toFixed(2));

  const diff: DiffSummary = {
    substitutions: stats.substitutions,
    omissions: stats.omissions,
    additions: stats.additions,
    transpositions: 0,
  };

  return {
    fidelityScore,
    diff,
  };
}

export type { DiffSummary };
