import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { DimCampaignModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type CampaignPayload = {
  campaignId: number;
  campaignTag: string;
  campaignName: string;
  campaignDescription?: string | null;
  campaignStartDate?: Date | null;
  campaignEndDate?: Date | null;
  campaignPurposeStatement?: string | null;
  campaignManager?: string | null;
  isActive?: boolean;
  isApproved?: boolean;
  isVisible?: boolean;
};

type ValidationResult =
  | { ok: true; data: CampaignPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

function validatePayload(payload: unknown): ValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const campaignId = payload["campaignId"];
  if (!isNumber(campaignId)) {
    return { ok: false, error: "campaignId must be a number." };
  }

  const campaignTag = payload["campaignTag"];
  if (typeof campaignTag !== "string" || campaignTag.trim().length === 0) {
    return { ok: false, error: "campaignTag must be a non-empty string." };
  }

  const campaignName = payload["campaignName"];
  if (typeof campaignName !== "string" || campaignName.trim().length === 0) {
    return { ok: false, error: "campaignName must be a non-empty string." };
  }

  const campaignDescription = payload["campaignDescription"];
  if (
    campaignDescription !== undefined &&
    campaignDescription !== null &&
    typeof campaignDescription !== "string"
  ) {
    return { ok: false, error: "campaignDescription must be a string or null." };
  }

  const campaignStartDate = parseDate(payload["campaignStartDate"]);
  if (payload["campaignStartDate"] !== undefined && campaignStartDate === undefined) {
    return { ok: false, error: "campaignStartDate must be a valid ISO date string or null." };
  }

  const campaignEndDate = parseDate(payload["campaignEndDate"]);
  if (payload["campaignEndDate"] !== undefined && campaignEndDate === undefined) {
    return { ok: false, error: "campaignEndDate must be a valid ISO date string or null." };
  }

  const campaignPurposeStatement = payload["campaignPurposeStatement"];
  if (
    campaignPurposeStatement !== undefined &&
    campaignPurposeStatement !== null &&
    typeof campaignPurposeStatement !== "string"
  ) {
    return { ok: false, error: "campaignPurposeStatement must be a string or null." };
  }

  const campaignManager = payload["campaignManager"];
  if (
    campaignManager !== undefined &&
    campaignManager !== null &&
    typeof campaignManager !== "string"
  ) {
    return { ok: false, error: "campaignManager must be a string or null." };
  }

  const isActive = payload["isActive"];
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return { ok: false, error: "isActive must be a boolean." };
  }

  const isApproved = payload["isApproved"];
  if (isApproved !== undefined && typeof isApproved !== "boolean") {
    return { ok: false, error: "isApproved must be a boolean." };
  }

  const isVisible = payload["isVisible"];
  if (isVisible !== undefined && typeof isVisible !== "boolean") {
    return { ok: false, error: "isVisible must be a boolean." };
  }

  return {
    ok: true,
    data: {
      campaignId,
      campaignTag: campaignTag.trim(),
      campaignName: campaignName.trim(),
      campaignDescription:
        campaignDescription === undefined
          ? undefined
          : campaignDescription === null
          ? null
          : campaignDescription.trim(),
      campaignStartDate,
      campaignEndDate,
      campaignPurposeStatement:
        campaignPurposeStatement === undefined
          ? undefined
          : campaignPurposeStatement === null
          ? null
          : campaignPurposeStatement.trim(),
      campaignManager:
        campaignManager === undefined
          ? undefined
          : campaignManager === null
          ? null
          : campaignManager.trim(),
      isActive,
      isApproved,
      isVisible,
    },
  };
}

export const runtime = "nodejs";

/**
 * GET /api/admin/campaigns
 *
 * Returns all campaigns with optional filtering.
 * Query params: isActive, isVisible (boolean filters)
 */
export async function GET(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  await connectToDatabase();

  const url = new URL(request.url);
  const filter: Record<string, boolean> = {};

  const isActiveParam = url.searchParams.get("isActive");
  if (isActiveParam === "true") filter.isActive = true;
  if (isActiveParam === "false") filter.isActive = false;

  const isVisibleParam = url.searchParams.get("isVisible");
  if (isVisibleParam === "true") filter.isVisible = true;
  if (isVisibleParam === "false") filter.isVisible = false;

  const campaigns = await DimCampaignModel.find(filter, { _id: 0 })
    .sort({ campaignId: -1 })
    .lean();

  return NextResponse.json({ ok: true, data: campaigns });
}

/**
 * POST /api/admin/campaigns
 *
 * Create or update a campaign (upsert by campaignId).
 */
export async function POST(request: Request) {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  await connectToDatabase();
  const now = new Date();

  const updateSet: Record<string, unknown> = {
    campaignTag: validation.data.campaignTag,
    campaignName: validation.data.campaignName,
  };

  if (validation.data.campaignDescription !== undefined) {
    updateSet.campaignDescription = validation.data.campaignDescription;
  }
  if (validation.data.campaignStartDate !== undefined) {
    updateSet.campaignStartDate = validation.data.campaignStartDate;
  }
  if (validation.data.campaignEndDate !== undefined) {
    updateSet.campaignEndDate = validation.data.campaignEndDate;
  }
  if (validation.data.campaignPurposeStatement !== undefined) {
    updateSet.campaignPurposeStatement = validation.data.campaignPurposeStatement;
  }
  if (validation.data.campaignManager !== undefined) {
    updateSet.campaignManager = validation.data.campaignManager;
  }
  if (validation.data.isActive !== undefined) {
    updateSet.isActive = validation.data.isActive;
  }
  if (validation.data.isApproved !== undefined) {
    updateSet.isApproved = validation.data.isApproved;
  }
  if (validation.data.isVisible !== undefined) {
    updateSet.isVisible = validation.data.isVisible;
  }

  try {
    // Build $setOnInsert for fields that have defaults when not provided
    const setOnInsert: Record<string, unknown> = {
      audit: {
        createdAt: now,
        createdBy: "admin",
      },
    };
    
    // Only add to $setOnInsert if NOT already in $set (avoids conflict)
    if (validation.data.isActive === undefined) {
      setOnInsert.isActive = true;
    }
    if (validation.data.isApproved === undefined) {
      setOnInsert.isApproved = false;
    }
    if (validation.data.isVisible === undefined) {
      setOnInsert.isVisible = true;
    }

    const campaign = await DimCampaignModel.findOneAndUpdate(
      { campaignId: validation.data.campaignId },
      {
        $set: updateSet,
        $setOnInsert: setOnInsert,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      ok: true,
      data: { campaignId: campaign.campaignId, campaignTag: campaign.campaignTag },
    });
  } catch (err) {
    const error = err as Error & { 
      code?: number; 
      keyPattern?: Record<string, number>;
      errInfo?: { details?: { operatorName?: string; schemaRulesNotSatisfied?: unknown[] } };
    };
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const duplicateField = error.keyPattern 
        ? Object.keys(error.keyPattern)[0] 
        : "unknown field";
      return NextResponse.json(
        { ok: false, error: `A campaign with this ${duplicateField} already exists.` },
        { status: 400 }
      );
    }
    
    // Handle MongoDB validation errors with clearer messages
    let message = error.message || "Failed to save campaign.";
    
    // Try to extract more useful info from MongoDB validation errors
    if (message.includes("Document failed validation")) {
      const details = error.errInfo?.details;
      if (details?.schemaRulesNotSatisfied) {
        message = `Validation failed. Please check all required fields are filled correctly. Details: ${JSON.stringify(details.schemaRulesNotSatisfied)}`;
      } else {
        message = "Validation failed. Please check all required fields are filled correctly (campaignId, campaignTag, campaignName, and status flags).";
      }
    }
    
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
