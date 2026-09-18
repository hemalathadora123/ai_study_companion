import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { executeTutorTurn } from "@/lib/ai/tutorPrompt";
import { awardPoints } from "@/lib/gamification/pointsService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error: any) {
    console.error("GET /api/conversations/[id]/messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
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

    const { id: conversationId } = await params;
    const body = await req.json();
    const { question, isVoice } = body;

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    if (question.trim().length > 2000) {
      return NextResponse.json({ error: "Question too long (max 2000 characters)" }, { status: 400 });
    }

    // Verify conversation ownership and get projectId
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || conversation.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found or unauthorized" }, { status: 404 });
    }

    // Execute the grounded tutor turn
    const result = await executeTutorTurn(
      conversation.projectId,
      user.id,
      conversationId,
      question.trim()
    );

    // Award points for active study engagement
    const rewardReason = isVoice ? "VOICE_INTERACTION" : "TUTOR_QUESTION";
    let rewardResult: any = null;
    try {
      rewardResult = await awardPoints(user.id, rewardReason, {
        projectId: conversation.projectId,
      });
    } catch (rewardErr) {
      console.warn("Failed to award points for tutor turn:", rewardErr);
    }

    return NextResponse.json({
      messageId: result.messageId,
      content: result.content,
      citations: result.citations,
      isUngrounded: result.isUngrounded,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      pointsAwarded: rewardResult?.pointsAwarded || (isVoice ? 15 : 10),
      newTotalPoints: rewardResult?.newTotalPoints,
      leveledUp: rewardResult?.leveledUp || false,
    });
  } catch (error: any) {
    console.error("POST /api/conversations/[id]/messages error:", error);
    return NextResponse.json({ error: "Failed to process tutor question" }, { status: 500 });
  }
}
