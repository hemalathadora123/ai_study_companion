import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserGamificationProfile,
  checkAndApplyDailyStreak,
} from "@/lib/gamification/pointsService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserGamificationProfile(user.id);
    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error("GET /api/rewards error:", error);
    return NextResponse.json({ error: "Failed to load rewards profile" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const streakResult = await checkAndApplyDailyStreak(user.id);
    const profile = await getUserGamificationProfile(user.id);

    return NextResponse.json({
      claimed: streakResult.isNewDay,
      pointsAwarded: streakResult.pointsAwarded,
      streakResult,
      profile,
    });
  } catch (error: any) {
    console.error("POST /api/rewards error:", error);
    return NextResponse.json({ error: "Failed to claim daily reward" }, { status: 500 });
  }
}
