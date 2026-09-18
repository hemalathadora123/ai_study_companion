import { prisma } from "@/lib/db";

export type RewardReason =
  | "DAILY_LOGIN"
  | "STREAK_BONUS_3_DAYS"
  | "STREAK_BONUS_7_DAYS"
  | "STREAK_BONUS_14_DAYS"
  | "TUTOR_QUESTION"
  | "VOICE_INTERACTION"
  | "QUIZ_COMPLETED"
  | "QUIZ_HIGH_SCORE"
  | "QUIZ_PERFECT"
  | "MATERIAL_PROCESSED"
  | "CONCEPT_MASTERED";

export const POINT_VALUES: Record<RewardReason, { points: number; description: string }> = {
  DAILY_LOGIN: { points: 30, description: "Daily Study Login" },
  STREAK_BONUS_3_DAYS: { points: 50, description: "3-Day Consistency Bonus" },
  STREAK_BONUS_7_DAYS: { points: 100, description: "7-Day Dedication Milestone" },
  STREAK_BONUS_14_DAYS: { points: 200, description: "14-Day Mastery Streak" },
  TUTOR_QUESTION: { points: 10, description: "Asked question to Grounded AI Tutor" },
  VOICE_INTERACTION: { points: 15, description: "Interactive Voice Companion session" },
  QUIZ_COMPLETED: { points: 30, description: "Completed an Adaptive Quiz" },
  QUIZ_HIGH_SCORE: { points: 20, description: "Scored 80%+ on Adaptive Quiz" },
  QUIZ_PERFECT: { points: 50, description: "100% Perfect Quiz Score" },
  MATERIAL_PROCESSED: { points: 20, description: "Uploaded & processed course notes" },
  CONCEPT_MASTERED: { points: 40, description: "Achieved High Concept Mastery (80%+)" },
};

export interface LevelInfo {
  level: number;
  title: string;
  minPoints: number;
  maxPoints: number;
  nextLevelPoints: number | null;
  progressPct: number;
}

export const LEVELS = [
  { level: 1, title: "Apprentice Scholar", min: 0, max: 199 },
  { level: 2, title: "Curious Explorer", min: 200, max: 499 },
  { level: 3, title: "Knowledge Builder", min: 500, max: 999 },
  { level: 4, title: "Concept Master", min: 1000, max: 1999 },
  { level: 5, title: "Grand Scholar", min: 2000, max: Infinity },
];

export function calculateLevel(points: number): LevelInfo {
  for (let i = 0; i < LEVELS.length; i++) {
    const lvl = LEVELS[i];
    if (points >= lvl.min && (lvl.max === Infinity || points <= lvl.max)) {
      const nextLevel = LEVELS[i + 1];
      const range = lvl.max === Infinity ? 1000 : lvl.max - lvl.min + 1;
      const progressInLevel = points - lvl.min;
      const progressPct = lvl.max === Infinity ? 100 : Math.min(100, Math.round((progressInLevel / range) * 100));

      return {
        level: lvl.level,
        title: lvl.title,
        minPoints: lvl.min,
        maxPoints: lvl.max,
        nextLevelPoints: nextLevel ? nextLevel.min : null,
        progressPct,
      };
    }
  }

  return {
    level: 1,
    title: "Apprentice Scholar",
    minPoints: 0,
    maxPoints: 199,
    nextLevelPoints: 200,
    progressPct: 0,
  };
}

export interface AwardPointsResult {
  pointsAwarded: number;
  newTotalPoints: number;
  newLevel: number;
  leveledUp: boolean;
  transaction: any;
}

/**
 * Awards points to a user, logs transaction, updates streaks & level.
 */
export async function awardPoints(
  userId: string,
  reason: RewardReason,
  options: {
    projectId?: string;
    customPoints?: number;
    description?: string;
  } = {}
): Promise<AwardPointsResult> {
  const defaultInfo = POINT_VALUES[reason];
  const points = options.customPoints ?? defaultInfo.points;
  const description = options.description ?? defaultInfo.description;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, level: true },
  });

  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  const newTotalPoints = user.points + points;
  const levelInfo = calculateLevel(newTotalPoints);
  const leveledUp = levelInfo.level > user.level;

  // 1. Create transaction record
  const transaction = await prisma.pointTransaction.create({
    data: {
      userId,
      projectId: options.projectId || null,
      points,
      reason,
      description,
    },
  });

  // 2. Update user points & level
  await prisma.user.update({
    where: { id: userId },
    data: {
      points: newTotalPoints,
      level: levelInfo.level,
    },
  });

  // 3. Log Learning Event for analytics
  await prisma.learningEvent.create({
    data: {
      userId,
      projectId: options.projectId || null,
      eventType: "POINTS_AWARDED",
      payloadJson: JSON.stringify({
        points,
        reason,
        newTotal: newTotalPoints,
        leveledUp,
      }),
    },
  });

  return {
    pointsAwarded: points,
    newTotalPoints,
    newLevel: levelInfo.level,
    leveledUp,
    transaction,
  };
}

/**
 * Verifies and applies daily login streak rewards
 */
export async function checkAndApplyDailyStreak(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastActiveDate: true,
      currentStreak: true,
      longestStreak: true,
      points: true,
    },
  });

  if (!user) return { streakCount: 0, isNewDay: false, pointsAwarded: 0 };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let streak = user.currentStreak;
  let longest = user.longestStreak;
  let isNewDay = false;
  let pointsAwarded = 0;

  if (!user.lastActiveDate) {
    // First time ever active
    streak = 1;
    longest = 1;
    isNewDay = true;
  } else {
    const lastActive = new Date(user.lastActiveDate);
    const lastDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());

    const diffDays = Math.round((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Already recorded today
      return { streakCount: streak, isNewDay: false, pointsAwarded: 0 };
    } else if (diffDays === 1) {
      // Consecutive day!
      streak += 1;
      longest = Math.max(longest, streak);
      isNewDay = true;
    } else {
      // Broken streak, reset to 1
      streak = 1;
      isNewDay = true;
    }
  }

  if (isNewDay) {
    // Award Daily Login points
    const dailyResult = await awardPoints(userId, "DAILY_LOGIN");
    pointsAwarded += dailyResult.pointsAwarded;

    // Check for streak milestones
    if (streak === 3) {
      const bonus = await awardPoints(userId, "STREAK_BONUS_3_DAYS");
      pointsAwarded += bonus.pointsAwarded;
    } else if (streak === 7) {
      const bonus = await awardPoints(userId, "STREAK_BONUS_7_DAYS");
      pointsAwarded += bonus.pointsAwarded;
    } else if (streak === 14) {
      const bonus = await awardPoints(userId, "STREAK_BONUS_14_DAYS");
      pointsAwarded += bonus.pointsAwarded;
    }

    // Update streak dates
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: streak,
        longestStreak: longest,
        lastActiveDate: now,
      },
    });
  }

  return { streakCount: streak, isNewDay, pointsAwarded };
}

export interface QuizPerformanceReward {
  basePoints: number;
  correctAnswersPoints: number;
  scoreBonusPoints: number;
  perfectBonusPoints: number;
  totalPointsAwarded: number;
  performanceTier: string;
}

/**
 * Calculates points for quiz participation and performance
 */
export function calculateQuizPerformancePoints(
  score: number,
  correctCount: number,
  totalQuestions: number
): QuizPerformanceReward {
  const basePoints = 20; // Base participation points for effort & finishing the assessment
  const correctAnswersPoints = Math.max(0, correctCount) * 10; // +10 points for each correct question

  let scoreBonusPoints = 0;
  let perfectBonusPoints = 0;
  let performanceTier = "Participant";

  if (score === 100) {
    perfectBonusPoints = 50;
    scoreBonusPoints = 40;
    performanceTier = "Perfect Mastery (100%)";
  } else if (score >= 80) {
    scoreBonusPoints = 30;
    performanceTier = "Distinction (80%+)";
  } else if (score >= 60) {
    scoreBonusPoints = 20;
    performanceTier = "Merit (60-79%)";
  } else if (score >= 40) {
    scoreBonusPoints = 10;
    performanceTier = "Passing Progress (40-59%)";
  }

  const totalPointsAwarded = basePoints + correctAnswersPoints + scoreBonusPoints + perfectBonusPoints;

  return {
    basePoints,
    correctAnswersPoints,
    scoreBonusPoints,
    perfectBonusPoints,
    totalPointsAwarded,
    performanceTier,
  };
}

/**
 * Awards performance-based points for a quiz and logs transaction with score details
 */
export async function awardQuizPerformancePoints(
  userId: string,
  quiz: {
    id: string;
    projectId: string;
    title: string;
    score: number;
    totalQuestions: number;
    correctCount: number;
  }
): Promise<{ reward: QuizPerformanceReward; pointsAwarded: number; transactionId?: string }> {
  // Check if points were already awarded for this specific quiz to prevent duplicate awarding
  const existingTx = await prisma.pointTransaction.findFirst({
    where: {
      userId,
      reason: "QUIZ_COMPLETED",
      description: { contains: quiz.id },
    },
  });

  const reward = calculateQuizPerformancePoints(quiz.score, quiz.correctCount, quiz.totalQuestions);

  if (existingTx) {
    return { reward, pointsAwarded: 0, transactionId: existingTx.id };
  }

  const description = `Quiz: "${quiz.title}" (${quiz.score}%, ${quiz.correctCount}/${quiz.totalQuestions} correct) [quizId:${quiz.id}]`;

  const result = await awardPoints(userId, "QUIZ_COMPLETED", {
    projectId: quiz.projectId,
    customPoints: reward.totalPointsAwarded,
    description,
  });

  return {
    reward,
    pointsAwarded: reward.totalPointsAwarded,
    transactionId: result.transaction.id,
  };
}

/**
 * Retroactively credits points for any completed quizzes that haven't been awarded yet
 */
export async function creditCompletedQuizzesForUser(userId: string) {
  try {
    const completedQuizzes = await prisma.quiz.findMany({
      where: {
        userId,
        status: "COMPLETED",
      },
      include: {
        attempts: true,
        questions: true,
      },
    });

    for (const quiz of completedQuizzes) {
      const alreadyAwarded = await prisma.pointTransaction.findFirst({
        where: {
          userId,
          reason: "QUIZ_COMPLETED",
          description: { contains: quiz.id },
        },
      });

      if (!alreadyAwarded) {
        const totalQuestions = quiz.questions.length || quiz.totalQuestions || 1;
        const correctCount = quiz.attempts.filter((a) => a.isCorrect).length;
        const score = typeof quiz.score === "number" ? quiz.score : Math.round((correctCount / totalQuestions) * 100);

        await awardQuizPerformancePoints(userId, {
          id: quiz.id,
          projectId: quiz.projectId,
          title: quiz.title,
          score,
          totalQuestions,
          correctCount,
        });
      }
    }
  } catch (err) {
    console.warn("creditCompletedQuizzesForUser error:", err);
  }
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: string;
}

/**
 * Calculates complete gamification profile including badges and milestones
 */
export async function getUserGamificationProfile(userId: string) {
  // Ensure any completed quizzes are credited before generating profile
  await creditCompletedQuizzesForUser(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      pointTransactions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: {
          projects: true,
          conversations: true,
          quizAttempts: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const levelInfo = calculateLevel(user.points);

  // Check achievements
  const tutorQuestionsCount = await prisma.pointTransaction.count({
    where: { userId, reason: "TUTOR_QUESTION" },
  });

  const voiceTurnsCount = await prisma.pointTransaction.count({
    where: { userId, reason: "VOICE_INTERACTION" },
  });

  const highQuizzesCount = await prisma.quiz.count({
    where: { userId, score: { gte: 80 } },
  });

  const highMasteryCount = await prisma.conceptMastery.count({
    where: { userId, masteryScore: { gte: 80 } },
  });

  // Calculate daily streak availability & lapsed status
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let currentStreak = user.currentStreak;
  let canClaimDaily = true;

  if (user.lastActiveDate) {
    const lastActive = new Date(user.lastActiveDate);
    const lastDay = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
    const diffDays = Math.round((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      canClaimDaily = false;
    } else if (diffDays === 1) {
      canClaimDaily = true;
    } else {
      // Missed more than 1 day: streak has lapsed to 0
      currentStreak = 0;
      canClaimDaily = true;
      if (user.currentStreak > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { currentStreak: 0 },
        });
      }
    }
  } else {
    // Brand new user, never claimed: streak is 0, can claim today
    currentStreak = 0;
    canClaimDaily = true;
  }

  const badges: Badge[] = [
    {
      id: "first_project",
      name: "First Step",
      description: "Created your first Focused Learning Project",
      icon: "Target",
      unlocked: user._count.projects > 0,
      progress: `${Math.min(1, user._count.projects)}/1`,
    },
    {
      id: "voice_pioneer",
      name: "Voice Pioneer",
      description: "Studied using the interactive Voice Companion",
      icon: "Mic",
      unlocked: voiceTurnsCount > 0,
      progress: `${Math.min(1, voiceTurnsCount)}/1`,
    },
    {
      id: "curious_mind",
      name: "Curious Mind",
      description: "Asked 5+ questions to your Grounded AI Tutor",
      icon: "Brain",
      unlocked: tutorQuestionsCount >= 5,
      progress: `${Math.min(5, tutorQuestionsCount)}/5`,
    },
    {
      id: "quiz_master",
      name: "Quiz Champion",
      description: "Scored 80%+ on an Adaptive Practice Quiz",
      icon: "Trophy",
      unlocked: highQuizzesCount > 0,
      progress: `${Math.min(1, highQuizzesCount)}/1`,
    },
    {
      id: "streak_pro",
      name: "Consistency King",
      description: "Maintained a 3-day study streak",
      icon: "Flame",
      unlocked: user.longestStreak >= 3,
      progress: `${Math.min(3, currentStreak)}/3 days`,
    },
    {
      id: "concept_ace",
      name: "Concept Ace",
      description: "Achieved 80%+ estimated mastery on a key concept",
      icon: "Sparkles",
      unlocked: highMasteryCount > 0,
      progress: `${Math.min(1, highMasteryCount)}/1`,
    },
  ];

  return {
    points: user.points,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    minPoints: levelInfo.minPoints,
    nextLevelPoints: levelInfo.nextLevelPoints,
    progressPct: levelInfo.progressPct,
    pointsToNext: levelInfo.nextLevelPoints ? levelInfo.nextLevelPoints - user.points : 0,
    currentStreak,
    longestStreak: user.longestStreak,
    lastActiveDate: user.lastActiveDate,
    canClaimDaily,
    badges,
    recentTransactions: user.pointTransactions,
  };
}
