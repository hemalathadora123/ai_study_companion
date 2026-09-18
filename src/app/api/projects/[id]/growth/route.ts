import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getProjectGrowthAnalytics } from "@/lib/masteryEngine";

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

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const analytics = await getProjectGrowthAnalytics(projectId, user.id);

    return NextResponse.json({ analytics });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/growth error:", error);
    return NextResponse.json({ error: "Failed to fetch growth analytics" }, { status: 500 });
  }
}
