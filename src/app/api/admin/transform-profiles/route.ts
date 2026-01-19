import { NextResponse } from "next/server";

import { isAdminAvailable } from "@/lib/admin";
import { TransformProfileModel } from "@/lib/models";
import { connectToDatabase } from "@/lib/mongodb";

type TransformStepPayload = {
  order: number;
  type: string;
  enabled: boolean;
  params: Record<string, unknown>;
};

type TransformProfilePayload = {
  profileId: number;
  name: string;
  scope: "canonical" | "model_output";
  version?: number;
  bibleId?: number | null;
  isDefault?: boolean;
  description?: string | null;
  steps: TransformStepPayload[];
  isActive: boolean;
};

type ValidationResult =
  | { ok: true; data: TransformProfilePayload }
  | { ok: false; error: string };

const allowedStepTypes = new Set([
  "stripMarkupTags",
  "stripParagraphMarkers",
  "stripVerseNumbers",
  "stripHeadings",
  "regexReplace",
  "replaceMap",
  "collapseWhitespace",
  "trim",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateProfile(payload: unknown): ValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const profileId = payload["profileId"];
  if (!isNumber(profileId)) {
    return { ok: false, error: "profileId must be a number." };
  }

  const name = payload["name"];
  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "name must be a non-empty string." };
  }

  const scope = payload["scope"];
  if (scope !== "canonical" && scope !== "model_output") {
    return { ok: false, error: "scope must be canonical or model_output." };
  }

  const steps = payload["steps"];
  if (!Array.isArray(steps) || steps.length === 0) {
    return { ok: false, error: "steps must be a non-empty array." };
  }

  const parsedSteps: TransformStepPayload[] = [];
  const seenOrders = new Set<number>();

  for (const step of steps) {
    if (!isRecord(step)) {
      return { ok: false, error: "Each step must be an object." };
    }

    const order = step["order"];
    if (!isNumber(order)) {
      return { ok: false, error: "step.order must be a number." };
    }

    if (seenOrders.has(order)) {
      return { ok: false, error: "step.order values must be unique." };
    }
    seenOrders.add(order);

    const type = step["type"];
    if (typeof type !== "string" || !allowedStepTypes.has(type)) {
      return { ok: false, error: "step.type is invalid." };
    }

    const enabled = step["enabled"];
    if (typeof enabled !== "boolean") {
      return { ok: false, error: "step.enabled must be a boolean." };
    }

    const params = step["params"];
    if (!isRecord(params)) {
      return { ok: false, error: "step.params must be an object." };
    }

    parsedSteps.push({
      order,
      type,
      enabled,
      params,
    });
  }

  const isActive = payload["isActive"];
  if (typeof isActive !== "boolean") {
    return { ok: false, error: "isActive must be a boolean." };
  }

  const versionValue = payload["version"];
  if (versionValue !== undefined && !isNumber(versionValue)) {
    return { ok: false, error: "version must be a number." };
  }

  const bibleIdValue = payload["bibleId"];
  if (bibleIdValue !== undefined && bibleIdValue !== null && !isNumber(bibleIdValue)) {
    return { ok: false, error: "bibleId must be a number or null." };
  }

  const isDefaultValue = payload["isDefault"];
  if (isDefaultValue !== undefined && typeof isDefaultValue !== "boolean") {
    return { ok: false, error: "isDefault must be a boolean." };
  }

  const isDefault = isDefaultValue === undefined ? undefined : isDefaultValue;
  const bibleId = isNumber(bibleIdValue) ? bibleIdValue : undefined;
  if (isDefault === true && bibleId === undefined) {
    return { ok: false, error: "bibleId is required when isDefault is true." };
  }

  if (isDefault === true && !isActive) {
    return { ok: false, error: "isDefault profiles must be active." };
  }

  const description = payload["description"];
  const normalizedDescription =
    description === undefined || description === null
      ? null
      : String(description);

  return {
    ok: true,
    data: {
      profileId,
      name,
      scope,
      version: versionValue as number | undefined,
      bibleId,
      isDefault,
      description: normalizedDescription,
      steps: parsedSteps,
      isActive,
    },
  };
}

export const runtime = "nodejs";

export async function GET() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  await connectToDatabase();
  const profiles = await TransformProfileModel.find({}, { _id: 0 }).sort({ profileId: 1 }).lean();
  return NextResponse.json({ ok: true, data: profiles });
}

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

  const validation = validateProfile(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  await connectToDatabase();
  const now = new Date();

  if (validation.data.isDefault === true && validation.data.bibleId !== undefined) {
    await TransformProfileModel.updateMany(
      {
        profileId: { $ne: validation.data.profileId },
        bibleId: validation.data.bibleId,
        scope: validation.data.scope,
        isDefault: true,
      },
      { $set: { isDefault: false } }
    );
  }

  const updateSet: Record<string, unknown> = {
    name: validation.data.name,
    scope: validation.data.scope,
    description: validation.data.description,
    steps: validation.data.steps,
    isActive: validation.data.isActive,
  };

  if (validation.data.bibleId !== undefined) {
    updateSet.bibleId = validation.data.bibleId;
  }

  if (validation.data.isDefault !== undefined) {
    updateSet.isDefault = validation.data.isDefault;
  }

  if (validation.data.version !== undefined) {
    updateSet.version = validation.data.version;
  }

  const profile = await TransformProfileModel.findOneAndUpdate(
    { profileId: validation.data.profileId },
    {
      $set: updateSet,
      $setOnInsert: {
        version: validation.data.version ?? 1,
        isDefault: validation.data.isDefault ?? false,
        audit: {
          createdAt: now,
          createdBy: "admin",
        },
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ ok: true, data: { profileId: profile.profileId } });
}
