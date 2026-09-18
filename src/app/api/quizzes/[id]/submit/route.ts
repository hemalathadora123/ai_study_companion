import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { evaluateQuizSubmission } from "@/lib/ai/quizEvaluator";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: quizId } = await params;
    const body = await req.json();
    const { answers } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "Answers array is required" }, { status: 400 });
    }

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz || quiz.userId !== user.id) {
      return NextResponse.json({ error: "Quiz not found or unauthorized" }, { status: 404 });
    }

    const evaluation = await evaluateQuizSubmission(quizId, user.id, answers);

    return NextResponse.json({ evaluation });
  } catch (error: any) {
    console.error("POST /api/quizzes/[id]/submit error:", error);
    return NextResponse.json({ error: "Failed to submit and grade quiz" }, { status: 500 });
  }
}
