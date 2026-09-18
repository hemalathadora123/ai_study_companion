import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateBlunderChallenge, evaluateBlunderAttempt } from "@/lib/ai/blunderGenerator";

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

    const challenge = await generateBlunderChallenge(projectId, user.id);

    return NextResponse.json({ challenge });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/blunder error:", error);
    return NextResponse.json({ error: "Failed to generate blunder challenge" }, { status: 500 });
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
    const { challenge, selectedStepIndex } = body;

    if (!challenge || typeof selectedStepIndex !== "number") {
      return NextResponse.json({ error: "Challenge and selectedStepIndex are required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const result = await evaluateBlunderAttempt(projectId, user.id, challenge, selectedStepIndex);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/blunder error:", error);
    return NextResponse.json({ error: "Failed to evaluate blunder attempt" }, { status: 500 });
  }
}
