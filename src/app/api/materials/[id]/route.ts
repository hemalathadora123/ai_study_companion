import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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

    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, userId: true, name: true, spaceId: true },
        },
        chunks: {
          orderBy: { chunkIndex: "asc" },
        },
      },
    });

    if (!material || material.project.userId !== user.id) {
      return NextResponse.json({ error: "Material not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ material });
  } catch (error: any) {
    console.error("GET /api/materials/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch material details" }, { status: 500 });
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

    const material = await prisma.material.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!material || material.project.userId !== user.id) {
      return NextResponse.json({ error: "Material not found or unauthorized" }, { status: 404 });
    }

    // Try deleting file from disk
    try {
      const safeFilename = path.basename(material.fileUrl);
      const diskPath = path.join(process.cwd(), "public", "uploads", safeFilename);

      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (fsErr) {
      console.warn("Could not delete file from disk:", fsErr);
    }

    // Delete DB record (chunks cascade delete automatically)
    await prisma.material.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/materials/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete material" }, { status: 500 });
  }
}
