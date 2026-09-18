import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateFlashcardsFromMaterials } from "@/lib/ai/flashcardGenerator";

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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const cards = await prisma.flashcard.findMany({
      where: { projectId, userId: user.id },
      orderBy: [{ masteryLevel: "asc" }, { createdAt: "desc" }],
    });

    const masteredCount = cards.filter((c) => c.masteryLevel >= 4).length;
    const learningCount = cards.filter((c) => c.masteryLevel >= 1 && c.masteryLevel < 4).length;
    const newCount = cards.filter((c) => c.masteryLevel === 0).length;

    return NextResponse.json({
      cards,
      metrics: {
        total: cards.length,
        mastered: masteredCount,
        learning: learningCount,
        new: newCount,
      },
    });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/flashcards error:", error);
    return NextResponse.json({ error: "Failed to fetch flashcards" }, { status: 500 });
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
    const body = await req.json().catch(() => ({}));
    const count = Number(body?.count) || 6;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const result = await generateFlashcardsFromMaterials(projectId, user.id, count);

    return NextResponse.json({
      cards: result.cards,
      count: result.count,
    });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/flashcards error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate flashcards" },
      { status: 500 }
    );
  }
}
