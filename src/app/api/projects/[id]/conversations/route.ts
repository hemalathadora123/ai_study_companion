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

    const { id: projectId } = await params;

    const conversations = await prisma.conversation.findMany({
      where: { projectId, userId: user.id },
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/conversations error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
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
    const title = body.title?.trim() || "New Learning Session";

    const conversation = await prisma.conversation.create({
      data: {
        projectId,
        userId: user.id,
        title,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/conversations error:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
