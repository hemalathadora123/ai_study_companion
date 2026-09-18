import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getObservabilityMetrics } from "@/lib/observability";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const feature = searchParams.get("feature") || undefined;
    const limit = Number(searchParams.get("limit")) || 200;

    const metrics = await getObservabilityMetrics({
      feature,
      limit,
    });

    return NextResponse.json({ metrics });
  } catch (error: any) {
    console.error("GET /api/admin/observability error:", error);
    return NextResponse.json({ error: "Failed to fetch observability metrics" }, { status: 500 });
  }
}
