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

    const { id } = await params;

    const space = await prisma.space.findFirst({
      where: { id, userId: user.id },
      include: {
        projects: {
          include: {
            _count: {
              select: {
                materials: true,
                concepts: true,
                quizzes: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    return NextResponse.json({ space });
  } catch (error: any) {
    console.error("GET /api/spaces/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch space details" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, icon, color } = body;

    const existing = await prisma.space.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const updated = await prisma.space.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description?.trim() : existing.description,
        icon: icon !== undefined ? icon : existing.icon,
        color: color !== undefined ? color : existing.color,
      },
    });

    return NextResponse.json({ space: updated });
  } catch (error: any) {
    console.error("PUT /api/spaces/[id] error:", error);
    return NextResponse.json({ error: "Failed to update space" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.space.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    await prisma.space.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/spaces/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete space" }, { status: 500 });
  }
}
