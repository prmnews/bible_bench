import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { DimCampaignModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type RouteParams = {
  params: Promise<{ campaignId: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

export const runtime = "nodejs";

/**
 * GET /api/admin/campaigns/[campaignId]
 *
 * Returns a single campaign by campaignId.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { campaignId: campaignIdParam } = await params;
  const campaignId = Number(campaignIdParam);
  if (!Number.isFinite(campaignId)) {
    return NextResponse.json(
      { ok: false, error: "campaignId must be a valid number." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const campaign = await DimCampaignModel.findOne({ campaignId }, { _id: 0 }).lean();
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: campaign });
}

/**
 * PUT /api/admin/campaigns/[campaignId]
 *
 * Update a campaign by campaignId.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { campaignId: campaignIdParam } = await params;
  const campaignId = Number(campaignIdParam);
  if (!Number.isFinite(campaignId)) {
    return NextResponse.json(
      { ok: false, error: "campaignId must be a valid number." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ ok: false, error: "Body must be a JSON object." }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await DimCampaignModel.findOne({ campaignId }).lean();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });
  }

  const updateSet: Record<string, unknown> = {};

  const campaignTag = body["campaignTag"];
  if (campaignTag !== undefined) {
    if (typeof campaignTag !== "string" || campaignTag.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "campaignTag must be a non-empty string." },
        { status: 400 }
      );
    }
    updateSet.campaignTag = campaignTag.trim();
  }

  const campaignName = body["campaignName"];
  if (campaignName !== undefined) {
    if (typeof campaignName !== "string" || campaignName.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "campaignName must be a non-empty string." },
        { status: 400 }
      );
    }
    updateSet.campaignName = campaignName.trim();
  }

  const campaignDescription = body["campaignDescription"];
  if (campaignDescription !== undefined) {
    if (campaignDescription !== null && typeof campaignDescription !== "string") {
      return NextResponse.json(
        { ok: false, error: "campaignDescription must be a string or null." },
        { status: 400 }
      );
    }
    updateSet.campaignDescription =
      campaignDescription === null ? null : campaignDescription.trim();
  }

  const campaignStartDate = parseDate(body["campaignStartDate"]);
  if (body["campaignStartDate"] !== undefined) {
    if (campaignStartDate === undefined) {
      return NextResponse.json(
        { ok: false, error: "campaignStartDate must be a valid ISO date string or null." },
        { status: 400 }
      );
    }
    updateSet.campaignStartDate = campaignStartDate;
  }

  const campaignEndDate = parseDate(body["campaignEndDate"]);
  if (body["campaignEndDate"] !== undefined) {
    if (campaignEndDate === undefined) {
      return NextResponse.json(
        { ok: false, error: "campaignEndDate must be a valid ISO date string or null." },
        { status: 400 }
      );
    }
    updateSet.campaignEndDate = campaignEndDate;
  }

  const campaignPurposeStatement = body["campaignPurposeStatement"];
  if (campaignPurposeStatement !== undefined) {
    if (campaignPurposeStatement !== null && typeof campaignPurposeStatement !== "string") {
      return NextResponse.json(
        { ok: false, error: "campaignPurposeStatement must be a string or null." },
        { status: 400 }
      );
    }
    updateSet.campaignPurposeStatement =
      campaignPurposeStatement === null ? null : campaignPurposeStatement.trim();
  }

  const campaignManager = body["campaignManager"];
  if (campaignManager !== undefined) {
    if (campaignManager !== null && typeof campaignManager !== "string") {
      return NextResponse.json(
        { ok: false, error: "campaignManager must be a string or null." },
        { status: 400 }
      );
    }
    updateSet.campaignManager = campaignManager === null ? null : campaignManager.trim();
  }

  const isActive = body["isActive"];
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "isActive must be a boolean." },
        { status: 400 }
      );
    }
    updateSet.isActive = isActive;
  }

  const isApproved = body["isApproved"];
  if (isApproved !== undefined) {
    if (typeof isApproved !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "isApproved must be a boolean." },
        { status: 400 }
      );
    }
    updateSet.isApproved = isApproved;
  }

  const isVisible = body["isVisible"];
  if (isVisible !== undefined) {
    if (typeof isVisible !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "isVisible must be a boolean." },
        { status: 400 }
      );
    }
    updateSet.isVisible = isVisible;
  }

  if (Object.keys(updateSet).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  const updated = await DimCampaignModel.findOneAndUpdate(
    { campaignId },
    { $set: updateSet },
    { new: true }
  );

  return NextResponse.json({
    ok: true,
    data: { campaignId: updated?.campaignId, campaignTag: updated?.campaignTag },
  });
}

/**
 * DELETE /api/admin/campaigns/[campaignId]
 *
 * Soft-delete a campaign by setting isActive=false and isVisible=false.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  const { campaignId: campaignIdParam } = await params;
  const campaignId = Number(campaignIdParam);
  if (!Number.isFinite(campaignId)) {
    return NextResponse.json(
      { ok: false, error: "campaignId must be a valid number." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const existing = await DimCampaignModel.findOne({ campaignId }).lean();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });
  }

  await DimCampaignModel.updateOne(
    { campaignId },
    { $set: { isActive: false, isVisible: false } }
  );

  return NextResponse.json({ ok: true, data: { campaignId, deleted: true } });
}
