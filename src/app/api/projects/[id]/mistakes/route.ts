import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { detectAndRemediateRepeatedMistakes } from "@/lib/repeatedMistakeEngine";

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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const result = await detectAndRemediateRepeatedMistakes(projectId, user.id);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("GET /api/projects/[id]/mistakes error:", error);
    return NextResponse.json({ error: "Failed to scan repeated mistakes" }, { status: 500 });
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const result = await detectAndRemediateRepeatedMistakes(projectId, user.id);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("POST /api/projects/[id]/mistakes error:", error);
    return NextResponse.json({ error: "Failed to trigger repeated mistake remediation" }, { status: 500 });
  }
}
