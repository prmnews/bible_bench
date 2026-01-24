/**
 * Transforms API - Fetch active transform profiles for client-side normalization
 *
 * Returns transform profiles with scope="model_output" that can be applied
 * in the Explorer for interactive re-scoring.
 *
 * GET /api/admin/transforms
 *   Query params:
 *     - scope: "model_output" | "canonical" | "all" (default: "model_output")
 *     - activeOnly: "true" | "false" (default: "true")
 */

import { NextRequest, NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { TransformProfileModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type TransformStepResponse = {
  order: number;
  type: string;
  enabled: boolean;
  params: Record<string, unknown>;
  severity?: "cosmetic" | "minor" | "significant" | "critical" | null;
  description?: string | null;
};

type TransformProfileResponse = {
  profileId: number;
  name: string;
  scope: "canonical" | "model_output";
  version: number;
  bibleId?: number;
  isDefault: boolean;
  description: string | null;
  steps: TransformStepResponse[];
  isActive: boolean;
};

export async function GET(request: NextRequest) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "model_output";
  const activeOnly = searchParams.get("activeOnly") !== "false";

  await connectToDatabase();

  // Build filter based on query params
  const filter: Record<string, unknown> = {};

  if (scope !== "all") {
    filter.scope = scope;
  }

  if (activeOnly) {
    filter.isActive = true;
  }

  const profiles = await TransformProfileModel.find(filter, { _id: 0, __v: 0 })
    .sort({ profileId: 1 })
    .lean();

  // Map to response format with explicit typing
  const data: TransformProfileResponse[] = profiles.map((p) => ({
    profileId: p.profileId,
    name: p.name,
    scope: p.scope as "canonical" | "model_output",
    version: p.version ?? 1,
    bibleId: p.bibleId ?? undefined,
    isDefault: p.isDefault ?? false,
    description: p.description ?? null,
    steps: (p.steps ?? []).map((s: {
      order: number;
      type: string;
      enabled: boolean;
      params?: Record<string, unknown>;
      severity?: string | null;
      description?: string | null;
    }) => ({
      order: s.order,
      type: s.type,
      enabled: s.enabled,
      params: s.params ?? {},
      severity: s.severity ?? null,
      description: s.description ?? null,
    })),
    isActive: p.isActive,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      profiles: data,
      count: data.length,
    },
  });
}
