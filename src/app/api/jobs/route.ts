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
    const status = searchParams.get("status");

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const jobs = await prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("GET /api/jobs error:", error);
    return NextResponse.json({ error: "Failed to fetch background jobs" }, { status: 500 });
  }
}
