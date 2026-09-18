import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const spaceId = searchParams.get("spaceId");

    const where: any = { userId: user.id };
    if (spaceId) {
      where.spaceId = spaceId;
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        space: {
          select: { id: true, name: true, color: true, icon: true },
        },
        _count: {
          select: {
            materials: true,
            concepts: true,
            quizzes: true,
            conversations: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { spaceId, name, description, learningGoal, targetDate } = body;

    if (!spaceId) {
      return NextResponse.json({ error: "Space ID is required" }, { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    if (!learningGoal || learningGoal.trim().length === 0) {
      return NextResponse.json({ error: "Learning goal is required" }, { status: 400 });
    }

    // Verify user owns the target space
    const space = await prisma.space.findFirst({
      where: { id: spaceId, userId: user.id },
    });

    if (!space) {
      return NextResponse.json({ error: "Target Space not found or unauthorized" }, { status: 404 });
    }

    const project = await prisma.project.create({
      data: {
        spaceId,
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        learningGoal: learningGoal.trim(),
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });

    // Record learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        projectId: project.id,
        eventType: "PROJECT_CREATED",
        payloadJson: JSON.stringify({
          projectName: project.name,
          learningGoal: project.learningGoal,
          spaceName: space.name,
        }),
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
