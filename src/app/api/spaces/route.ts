import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const spaces = await prisma.space.findMany({
      where: { userId: user.id },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            progress: true,
            status: true,
          },
        },
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ spaces });
  } catch (error: any) {
    console.error("GET /api/spaces error:", error);
    return NextResponse.json({ error: "Failed to fetch spaces" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, icon, color } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Space name is required" }, { status: 400 });
    }

    const space = await prisma.space.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || "Folder",
        color: color || "indigo",
      },
    });

    // Record learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        eventType: "PROJECT_CREATED",
        payloadJson: JSON.stringify({ spaceId: space.id, spaceName: space.name }),
      },
    });

    return NextResponse.json({ space }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/spaces error:", error);
    return NextResponse.json({ error: "Failed to create space" }, { status: 500 });
  }
}
