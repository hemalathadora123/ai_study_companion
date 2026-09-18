import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const limit = Math.min(100, Number(searchParams.get("limit")) || 25);

    const whereClause: any = { userId: user.id };
    if (projectId) {
      whereClause.projectId = projectId;
    }

    const events = await prisma.learningEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch learning events" }, { status: 500 });
  }
}
