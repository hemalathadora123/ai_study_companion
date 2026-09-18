import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { runAiEvaluationSuite } from "@/lib/ai/evaluationSuite";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const latestLog = await prisma.aiLog.findFirst({
      where: { feature: "EVALUATION_BENCHMARK" },
      orderBy: { createdAt: "desc" },
    });

    let lastReport = null;
    if (latestLog?.metadataJson) {
      try {
        lastReport = JSON.parse(latestLog.metadataJson);
      } catch {}
    }

    return NextResponse.json({
      lastReport,
      lastRunAt: latestLog?.createdAt || null,
    });
  } catch (error: any) {
    console.error("GET /api/admin/evaluation error:", error);
    return NextResponse.json({ error: "Failed to fetch evaluation report" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { projectId } = body;

    const report = await runAiEvaluationSuite(projectId, user.id);

    return NextResponse.json({ report }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/admin/evaluation error:", error);
    return NextResponse.json({ error: "Failed to run AI evaluation suite" }, { status: 500 });
  }
}
