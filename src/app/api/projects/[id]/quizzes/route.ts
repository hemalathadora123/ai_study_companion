import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateAdaptiveQuiz } from "@/lib/ai/quizGenerator";

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

    const quizzes = await prisma.quiz.findMany({
      where: {
        projectId,
        userId: user.id,
      },
      include: {
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ quizzes });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/quizzes error:", error);
    return NextResponse.json({ error: "Failed to fetch quizzes" }, { status: 500 });
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
    const questionCount = typeof body.questionCount === "number" ? body.questionCount : 3;

    // Verify project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const result = await generateAdaptiveQuiz(projectId, user.id, questionCount);

    return NextResponse.json({ quiz: result }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/quizzes error:", error);
    return NextResponse.json({ error: "Failed to generate adaptive quiz" }, { status: 500 });
  }
}
