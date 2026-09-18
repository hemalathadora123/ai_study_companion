import { prisma } from "@/lib/db";

export interface ConceptGrowthItem {
  conceptId: string;
  name: string;
  description?: string | null;
  masteryScore: number;
  status: "STABLE" | "IMPROVING" | "NEEDS_ATTENTION";
  totalAttempts: number;
  correctAttempts: number;
  accuracyRate: number;
  lastAssessedAt?: Date | null;
  history: { timestamp: string; score: number }[];
  retentionRate?: number; // Ebbinghaus memory retention % (0-100)
}

export interface ProjectGrowthSummary {
  projectId: string;
  projectName: string;
  overallProgress: number; // 0 - 100
  totalConcepts: number;
  stableCount: number;
  improvingCount: number;
  needsAttentionCount: number;
  totalAttempts: number;
  overallAccuracyRate: number;
  concepts: ConceptGrowthItem[];
  recentQuizScores: { id: string; title: string; score: number; completedAt: string }[];
}

/**
 * Aggregates concept mastery, calculates growth trajectories, and updates Project.progress.
 */
export async function getProjectGrowthAnalytics(
  projectId: string,
  userId: string
): Promise<ProjectGrowthSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      concepts: {
        include: {
          masteries: {
            where: { userId },
          },
        },
      },
      quizzes: {
        where: { userId, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          score: true,
          completedAt: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const conceptItems: ConceptGrowthItem[] = [];
  let totalScoreSum = 0;
  let totalAttemptsSum = 0;
  let correctAttemptsSum = 0;
  let stableCount = 0;
  let improvingCount = 0;
  let needsAttentionCount = 0;

  for (const concept of project.concepts) {
    const mastery = concept.masteries[0];
    const score = mastery ? mastery.masteryScore : 0;
    const totalAttempts = mastery ? mastery.totalAttempts : 0;
    const correctAttempts = mastery ? mastery.correctAttempts : 0;
    const accuracyRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    let status: "STABLE" | "IMPROVING" | "NEEDS_ATTENTION" = "NEEDS_ATTENTION";
    if (score >= 75) {
      status = "STABLE";
      stableCount++;
    } else if (score >= 60) {
      status = "IMPROVING";
      improvingCount++;
    } else {
      status = "NEEDS_ATTENTION";
      needsAttentionCount++;
    }

    // Parse trajectory history
    let history: { timestamp: string; score: number }[] = [];
    if (mastery?.historyJson) {
      try {
        history = JSON.parse(mastery.historyJson);
      } catch {
        history = [];
      }
    }
    // Ensure current score is represented in history
    if (history.length === 0) {
      history.push({
        timestamp: (mastery?.createdAt || new Date()).toISOString(),
        score,
      });
    }

    totalScoreSum += score;
    totalAttemptsSum += totalAttempts;
    correctAttemptsSum += correctAttempts;

    // Ebbinghaus Forgetting Curve Calculation: R = e^(-t / S)
    let retentionRate: number | undefined = undefined;
    if (mastery?.lastAssessedAt && totalAttempts > 0) {
      const daysElapsed = Math.max(
        0,
        (Date.now() - new Date(mastery.lastAssessedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      // Stability factor S grows with mastery score and attempt repetitions
      const stability = Math.max(2, (score / 20) * Math.log2(totalAttempts + 2));
      retentionRate = Math.min(
        100,
        Math.max(10, Math.round(100 * Math.exp(-daysElapsed / stability)))
      );
    }

    conceptItems.push({
      conceptId: concept.id,
      name: concept.name,
      description: concept.description,
      masteryScore: score,
      status,
      totalAttempts,
      correctAttempts,
      accuracyRate,
      lastAssessedAt: mastery?.lastAssessedAt || null,
      history,
      retentionRate,
    });
  }

  const totalConcepts = project.concepts.length;
  const overallProgress = totalConcepts > 0 ? Math.round(totalScoreSum / totalConcepts) : 0;
  const overallAccuracyRate = totalAttemptsSum > 0 ? Math.round((correctAttemptsSum / totalAttemptsSum) * 100) : 0;

  // Sync Project.progress in SQLite if changed
  if (Math.round(project.progress) !== overallProgress) {
    await prisma.project.update({
      where: { id: projectId },
      data: { progress: overallProgress },
    });
  }

  return {
    projectId,
    projectName: project.name,
    overallProgress,
    totalConcepts,
    stableCount,
    improvingCount,
    needsAttentionCount,
    totalAttempts: totalAttemptsSum,
    overallAccuracyRate,
    concepts: conceptItems,
    recentQuizScores: project.quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      score: q.score || 0,
      completedAt: q.completedAt?.toISOString() || new Date().toISOString(),
    })),
  };
}

/**
 * Updates a concept's mastery score and appends to its historical growth trajectory.
 */
export async function updateConceptMasteryWithHistory(
  userId: string,
  projectId: string,
  conceptId: string,
  newScore: number
) {
  const boundedScore = Math.max(0, Math.min(100, Math.round(newScore)));
  const existingMastery = await prisma.conceptMastery.findFirst({
    where: { userId, projectId, conceptId },
  });

  let history: { timestamp: string; score: number }[] = [];
  if (existingMastery?.historyJson) {
    try {
      history = JSON.parse(existingMastery.historyJson);
    } catch {
      history = [];
    }
  }

  history.push({
    timestamp: new Date().toISOString(),
    score: boundedScore,
  });

  // Limit history array to last 20 entries
  if (history.length > 20) {
    history = history.slice(-20);
  }

  let status: "STABLE" | "IMPROVING" | "NEEDS_ATTENTION" = "NEEDS_ATTENTION";
  if (boundedScore >= 75) {
    status = "STABLE";
  } else if (boundedScore >= 60) {
    status = "IMPROVING";
  }

  return prisma.conceptMastery.upsert({
    where: {
      userId_projectId_conceptId: {
        userId,
        projectId,
        conceptId,
      },
    },
    update: {
      masteryScore: boundedScore,
      status,
      lastAssessedAt: new Date(),
      historyJson: JSON.stringify(history),
    },
    create: {
      userId,
      projectId,
      conceptId,
      masteryScore: boundedScore,
      status,
      lastAssessedAt: new Date(),
      historyJson: JSON.stringify(history),
    },
  });
}
