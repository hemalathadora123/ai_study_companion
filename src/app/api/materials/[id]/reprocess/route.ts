import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { enqueueJob } from "@/lib/queue";

export async function POST(
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

    // Reset material status to QUEUED
    await prisma.material.update({
      where: { id },
      data: {
        status: "QUEUED",
        errorMessage: null,
      },
    });

    // Enqueue document processing background job
    const job = await enqueueJob({
      jobType: "PROCESS_DOCUMENT",
      payload: { materialId: material.id, projectId: material.projectId },
    });

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error("POST /api/materials/[id]/reprocess error:", error);
    return NextResponse.json({ error: "Failed to reprocess material" }, { status: 500 });
  }
}
