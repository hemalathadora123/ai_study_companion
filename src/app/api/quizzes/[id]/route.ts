import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: quizId } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            concept: { select: { id: true, name: true } },
          },
          orderBy: { id: "asc" },
        },
        attempts: {
          where: { userId: user.id },
          orderBy: { answeredAt: "asc" },
        },
      },
    });

    if (!quiz || quiz.userId !== user.id) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ quiz });
  } catch (error: any) {
    console.error("GET /api/quizzes/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch quiz details" }, { status: 500 });
  }
}
