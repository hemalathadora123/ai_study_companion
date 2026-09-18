import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { enqueueJob } from "@/lib/queue";

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

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const materials = await prisma.material.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ materials });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/materials error:", error);
    return NextResponse.json({ error: "Failed to fetch materials" }, { status: 500 });
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

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formErr: any) {
      console.error("Failed to parse form data:", formErr);
      return NextResponse.json(
        { error: "Failed to parse upload. The file may exceed size limits or was corrupted during transfer." },
        { status: 400 }
      );
    }
    const file = formData.get("file") as File | null;
    const titleInput = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validation: PDF file extension & MIME
    const filename = file.name || "document.pdf";
    const isPdf = filename.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    if (!isPdf) {
      return NextResponse.json({ error: "Only PDF files are supported for processing" }, { status: 400 });
    }

    // Validation: Size limit (25 MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds maximum allowed limit (25 MB)" }, { status: 400 });
    }

    // Save file to disk in public/uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFilename = `${timestamp}-${cleanFilename}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    const fileUrl = `/uploads/${uniqueFilename}`;

    fs.writeFileSync(filePath, buffer);

    const title = titleInput?.trim() || filename.replace(/\.pdf$/i, "");

    // Create Material record in QUEUED status
    const material = await prisma.material.create({
      data: {
        projectId,
        title,
        originalFilename: filename,
        fileUrl,
        fileSize: file.size,
        mimeType: "application/pdf",
        status: "QUEUED",
      },
    });

    // Enqueue background processing job
    await enqueueJob({
      jobType: "PROCESS_DOCUMENT",
      payload: { materialId: material.id, projectId },
    });

    // Record learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        projectId,
        eventType: "MATERIAL_UPLOADED",
        payloadJson: JSON.stringify({
          materialId: material.id,
          title: material.title,
          fileSize: file.size,
        }),
      },
    });

    return NextResponse.json({ material }, { status: 202 });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/materials error:", error);
    return NextResponse.json({ error: "Failed to upload and queue document" }, { status: 500 });
  }
}
