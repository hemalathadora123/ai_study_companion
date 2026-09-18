import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateProjectRecommendations } from "@/lib/ai/recommendationEngine";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    let recommendations = await prisma.recommendation.findMany({
      where: {
        projectId,
        userId: user.id,
        isDismissed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    // If no recommendations exist yet, generate initial ones automatically
    if (recommendations.length === 0) {
      await generateProjectRecommendations(projectId, user.id);
      recommendations = await prisma.recommendation.findMany({
        where: {
          projectId,
          userId: user.id,
          isDismissed: false,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ recommendations });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/recommendations error:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const recommendations = await generateProjectRecommendations(projectId, user.id);

    return NextResponse.json({ recommendations });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/recommendations error:", error);
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
