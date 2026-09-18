import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserGamificationProfile,
  checkAndApplyDailyStreak,
} from "@/lib/gamification/pointsService";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's individual gamification profile
    const gamification = await getUserGamificationProfile(user.id);

    // 1. Fetch user's spaces
    const spaces = await prisma.space.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 2. Fetch user's projects
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        space: {
          select: { id: true, name: true, color: true, icon: true },
        },
        _count: {
          select: {
            materials: true,
            concepts: true,
            quizzes: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3. Continue Learning project (most recently updated or active)
    const continueLearningProject = projects.length > 0 ? projects[0] : null;

    // 4. Areas requiring attention (Mastery < 60 or status NEEDS_ATTENTION)
    const weakConcepts = await prisma.conceptMastery.findMany({
      where: {
        userId: user.id,
        masteryScore: { lt: 60 },
      },
      include: {
        concept: { select: { id: true, name: true, importanceLevel: true } },
        project: { select: { id: true, name: true, spaceId: true } },
      },
      orderBy: { masteryScore: "asc" },
      take: 5,
    });

    // 5. Actionable recommendations
    const recommendations = await prisma.recommendation.findMany({
      where: {
        userId: user.id,
        isDismissed: false,
        isCompleted: false,
      },
      include: {
        project: { select: { id: true, name: true, spaceId: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 4,
    });

    // 6. Overall average mastery across all projects
    const allMasteries = await prisma.conceptMastery.findMany({
      where: { userId: user.id },
      select: { masteryScore: true },
    });

    const averageMastery =
      allMasteries.length > 0
        ? Math.round(
            allMasteries.reduce((sum, item) => sum + item.masteryScore, 0) /
              allMasteries.length
          )
        : 0;

    return NextResponse.json({
      user,
      spaces,
      projects,
      continueLearningProject,
      weakConcepts,
      recommendations,
      gamification,
      stats: {
        totalSpaces: spaces.length,
        totalProjects: projects.length,
        averageMastery,
        weakConceptsCount: weakConcepts.length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/home error:", error);
    return NextResponse.json({ error: "Failed to load home dashboard" }, { status: 500 });
  }
}
