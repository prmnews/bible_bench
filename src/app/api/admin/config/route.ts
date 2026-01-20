import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { AppConfigModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

// GET - List all config keys
export async function GET() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  await connectToDatabase();
  const configs = await AppConfigModel.find({}, { _id: 0 })
    .sort({ key: 1 })
    .lean();

  return NextResponse.json({ ok: true, data: configs });
}
