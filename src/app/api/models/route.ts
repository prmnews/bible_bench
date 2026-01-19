import { NextResponse } from "next/server";

import { ModelModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  await connectToDatabase();

  const models = await ModelModel.find(
    { isActive: true },
    { _id: 0, modelId: 1, displayName: 1, provider: 1, version: 1 }
  )
    .sort({ modelId: 1 })
    .lean();

  return NextResponse.json({ ok: true, data: models });
}
