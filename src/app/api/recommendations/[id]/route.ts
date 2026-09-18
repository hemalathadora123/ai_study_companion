import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: recommendationId } = await params;
    const body = await req.json();
    const { isCompleted, isDismissed } = body;

    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
    });

    if (!recommendation || recommendation.userId !== user.id) {
      return NextResponse.json({ error: "Recommendation not found or unauthorized" }, { status: 404 });
    }

    const updated = await prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        ...(typeof isCompleted === "boolean" ? { isCompleted } : {}),
        ...(typeof isDismissed === "boolean" ? { isDismissed } : {}),
      },
    });

    return NextResponse.json({ recommendation: updated });
  } catch (error: any) {
    console.error("PATCH /api/recommendations/[id] error:", error);
    return NextResponse.json({ error: "Failed to update recommendation" }, { status: 500 });
  }
}
