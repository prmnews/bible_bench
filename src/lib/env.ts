type EnvValidationResult = {
  ok: boolean;
  isProduction: boolean;
  missing: string[];
  warnings: string[];
  environment: {
    nodeEnv: string;
    vercelEnv: string;
  };
};

const REQUIRED_ENV = ["MONGODB_URI"] as const;
const PRODUCTION_REQUIRED_ENV = ["MONGODB_DBNAME"] as const;

function isProductionEnv(nodeEnv: string, vercelEnv: string) {
  return nodeEnv === "production" || vercelEnv === "production";
}

function isMissing(value: string | undefined) {
  return value === undefined || value.trim().length === 0;
}

export function validateEnv(): EnvValidationResult {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const vercelEnv = process.env.VERCEL_ENV ?? "local";
  const isProduction = isProductionEnv(nodeEnv, vercelEnv);
  const required = [
    ...REQUIRED_ENV,
    ...(isProduction ? PRODUCTION_REQUIRED_ENV : []),
  ];

  const missing = required.filter((key) => isMissing(process.env[key]));
  const warnings: string[] = [];

  if (isProduction && process.env.ADMIN_LOCAL_ONLY === "true") {
    warnings.push("ADMIN_LOCAL_ONLY=true exposes admin routes in production.");
  }

  return {
    ok: missing.length === 0,
    isProduction,
    missing,
    warnings,
    environment: { nodeEnv, vercelEnv },
  };
}

export function assertEnv(): EnvValidationResult {
  const result = validateEnv();
  if (!result.ok) {
    throw new Error(`Missing required environment variables: ${result.missing.join(", ")}`);
  }
  return result;
}

export type { EnvValidationResult };
