import { NextResponse } from "next/server";

import { validateEnv } from "@/lib/env";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  const env = validateEnv();
  const hasUri = Boolean(process.env.MONGODB_URI);
  const hasDbName = Boolean(process.env.MONGODB_DBNAME);
  let dbConnected = false;

  if (hasUri) {
    try {
      await connectToDatabase();
      dbConnected = true;
    } catch {
      dbConnected = false;
    }
  }

  const status = env.ok ? "ok" : "error";

  return NextResponse.json(
    {
      status,
      dbConnected,
      dbNameConfigured: hasDbName,
      env,
    },
    { status: env.ok ? 200 : 500 }
  );
}
