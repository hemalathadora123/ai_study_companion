import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateVivaQuestion, evaluateVivaExplanation } from "@/lib/ai/vivaEvaluator";

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

    const vivaQuestion = await generateVivaQuestion(projectId, user.id);

    return NextResponse.json({ question: vivaQuestion });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/viva error:", error);
    return NextResponse.json({ error: "Failed to generate viva question" }, { status: 500 });
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
    const body = await req.json();
    const { conceptId, questionPrompt, speechText } = body;

    if (!conceptId || !speechText || !speechText.trim()) {
      return NextResponse.json(
        { error: "conceptId and speechText are required" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const result = await evaluateVivaExplanation(
      projectId,
      user.id,
      conceptId,
      questionPrompt || "Explain this concept",
      speechText.trim()
    );

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/viva error:", error);
    return NextResponse.json({ error: "Failed to evaluate viva explanation" }, { status: 500 });
  }
}
