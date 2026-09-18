import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: user.role === "ADMIN" ? { id } : { id, userId: user.id },
      include: {
        space: {
          select: { id: true, name: true, color: true, icon: true },
        },
        materials: {
          orderBy: { createdAt: "desc" },
        },
        concepts: {
          include: {
            masteries: {
              where: { userId: user.id },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        recommendations: {
          where: { isDismissed: false },
          orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        },
        conversations: {
          include: {
            messages: {
              take: 5,
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        },
        quizzes: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // Calculate aggregated concept mastery
    const masteries = await prisma.conceptMastery.findMany({
      where: { projectId: project.id, userId: user.id },
    });

    const averageMastery =
      masteries.length > 0
        ? Math.round(
            masteries.reduce((sum, m) => sum + m.masteryScore, 0) / masteries.length
          )
        : 0;

    return NextResponse.json({
      project,
      averageMastery,
      masteries,
    });
  } catch (error: any) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch project details" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, learningGoal, status, progress } = body;

    const existing = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description?.trim() : existing.description,
        learningGoal: learningGoal !== undefined ? learningGoal.trim() : existing.learningGoal,
        status: status !== undefined ? status : existing.status,
        progress: progress !== undefined ? progress : existing.progress,
      },
    });

    return NextResponse.json({ project: updated });
  } catch (error: any) {
    console.error("PUT /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
