import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserGamificationProfile } from "@/lib/gamification/pointsService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserGamificationProfile(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        points: profile.points,
        level: profile.level,
        levelTitle: profile.levelTitle,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
      },
    });
  } catch (error: any) {
    console.error("Get current user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
