import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { reviewFlashcard } from "@/lib/ai/flashcardGenerator";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, cardId } = await params;
    const body = await req.json();
    const { rating } = body; // AGAIN, GOOD, EASY

    if (!["AGAIN", "GOOD", "EASY"].includes(rating)) {
      return NextResponse.json({ error: "Valid rating (AGAIN, GOOD, EASY) is required" }, { status: 400 });
    }

    const result = await reviewFlashcard(cardId, rating, user.id);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("PATCH /api/projects/[id]/flashcards/[cardId] error:", error);
    return NextResponse.json({ error: "Failed to update flashcard review" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, cardId } = await params;

    const card = await prisma.flashcard.findUnique({
      where: { id: cardId },
    });

    if (!card || card.userId !== user.id) {
      return NextResponse.json({ error: "Flashcard not found or unauthorized" }, { status: 404 });
    }

    await prisma.flashcard.delete({
      where: { id: cardId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/projects/[id]/flashcards/[cardId] error:", error);
    return NextResponse.json({ error: "Failed to delete flashcard" }, { status: 500 });
  }
}
