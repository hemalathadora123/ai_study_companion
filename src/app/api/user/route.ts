import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser(req);
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      currentUser,
      availableUsers: allUsers,
    });
  } catch (error: any) {
    console.error("GET /api/user error:", error);
    return NextResponse.json({ error: "Failed to fetch user context" }, { status: 500 });
  }
}
