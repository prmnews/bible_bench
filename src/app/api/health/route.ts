import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
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

  return NextResponse.json({ status: "ok", dbConnected, dbNameConfigured: hasDbName });
}
