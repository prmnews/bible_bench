import { openApiSpec } from "@/lib/openapi";
import { isAdminAvailable } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  if (!isAdminAvailable()) {
    return new Response("Not Found", { status: 404 });
  }

  return Response.json(openApiSpec);
}
