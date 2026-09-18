import { prisma } from "@/lib/db";
import { generateAiResponse } from "./provider";

export interface GeneratedRecommendationPayload {
  type: "REVIEW_MATERIAL" | "PRACTICE_QUIZ" | "EXPLORE_CONCEPT" | "REPEATED_MISTAKE_REMEDIATION";
  title: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  targetUrl: string;
}

/**
 * Generates personalized, actionable study recommendations for the learner.
 * Identifies weak concepts, recent quiz errors, and ungrounded queries to answer "What should I do next?".
 */
export async function generateProjectRecommendations(
  projectId: string,
  userId: string
): Promise<GeneratedRecommendationPayload[]> {
  // 1. Fetch learner context: concepts, masteries, recent quiz attempts, materials
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      concepts: {
        include: {
          masteries: { where: { userId } },
        },
      },
      materials: {
        where: { status: "READY" },
        select: { id: true, title: true, totalPages: true },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // 2. Classify concepts
  const weakConcepts: string[] = [];
  const recoveringConcepts: string[] = [];

  for (const concept of project.concepts) {
    const score = concept.masteries[0]?.masteryScore ?? 50;
    if (score < 60) {
      weakConcepts.push(concept.name);
    } else if (score < 75) {
      recoveringConcepts.push(concept.name);
    }
  }

  // 3. Fetch recent quiz errors
  const recentMissedAttempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      quiz: { projectId },
      isCorrect: false,
    },
    orderBy: { answeredAt: "desc" },
    take: 5,
    include: {
      question: { select: { prompt: true, concept: { select: { name: true } } } },
    },
  });

  const missedTopics = recentMissedAttempts
    .map((a) => a.question.concept?.name)
    .filter(Boolean) as string[];

  // 4. Construct AI prompt
  const systemInstruction = `You are a personalized AI learning coach.
Analyze the student's mastery profile and generate 2 to 4 high-impact, actionable study recommendations answering: "What should I do next?".
Output ONLY a JSON array of recommendation objects.`;

  const prompt = `PROJECT: "${project.name}" (Goal: "${project.learningGoal}")
WEAK CONCEPTS (<60%): [${weakConcepts.join(", ") || "None currently"}]
RECOVERING CONCEPTS (60-74%): [${recoveringConcepts.join(", ") || "None"}]
RECENT QUIZ MISCONCEPTIONS: [${missedTopics.join(", ") || "No recent errors"}]
AVAILABLE MATERIALS: ${project.materials.map((m) => `"${m.title}" (${m.totalPages} pages)`).join(", ") || "General notes"}

RECOMMENDATION REQUIREMENTS:
Generate recommendations using these types:
- "REVIEW_MATERIAL": Points to reviewing specific project documents. targetUrl: "/projects/${projectId}?tab=materials"
- "PRACTICE_QUIZ": Suggests taking an adaptive quiz. targetUrl: "/projects/${projectId}?tab=quiz"
- "EXPLORE_CONCEPT": Suggests asking the Grounded AI Tutor. targetUrl: "/projects/${projectId}?tab=tutor"
- "REPEATED_MISTAKE_REMEDIATION": High-priority intervention if a concept was missed repeatedly. targetUrl: "/projects/${projectId}?tab=materials"

JSON FORMAT SCHEMA:
[
  {
    "type": "REVIEW_MATERIAL",
    "title": "Clear action title",
    "reason": "Specific pedagogical explanation why this step is recommended right now.",
    "priority": "HIGH",
    "targetUrl": "/projects/${projectId}?tab=materials"
  }
]`;

  // 5. Call AI Provider
  const aiResult = await generateAiResponse({
    systemInstruction,
    prompt,
    feature: "RECOMMENDATIONS",
    userId,
    metadata: {
      projectId,
      weakConcepts,
    },
  });

  // 6. Parse recommendations
  let recommendations: GeneratedRecommendationPayload[] = [];
  try {
    const cleaned = aiResult.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    recommendations = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse recommendations JSON:", aiResult.text);
    // Fallback recommendation based on weak concepts
    const primaryWeak = weakConcepts[0] || "Foundational concepts";
    recommendations = [
      {
        type: "REVIEW_MATERIAL",
        title: `Review ${primaryWeak} in Project Materials`,
        reason: `Your current mastery on ${primaryWeak} is below target. Re-reading the lecture excerpts will solidify the core ideas.`,
        priority: "HIGH",
        targetUrl: `/projects/${projectId}?tab=materials`,
      },
      {
        type: "PRACTICE_QUIZ",
        title: "Take Adaptive Quiz on Weak Areas",
        reason: "Active retrieval practice is the fastest way to turn fragile knowledge into long-term recall.",
        priority: "HIGH",
        targetUrl: `/projects/${projectId}?tab=quiz`,
      },
    ];
  }

  // 7. Persist recommendations in database
  // Mark old active recommendations as dismissed to keep recommendations clean & fresh
  await prisma.recommendation.updateMany({
    where: {
      projectId,
      userId,
      isCompleted: false,
      isDismissed: false,
    },
    data: { isDismissed: true },
  });

  for (const rec of recommendations) {
    await prisma.recommendation.create({
      data: {
        projectId,
        userId,
        type: rec.type,
        title: rec.title,
        reason: rec.reason,
        priority: rec.priority || "MEDIUM",
        targetUrl: rec.targetUrl,
        isCompleted: false,
        isDismissed: false,
      },
    });
  }

  // 8. Emit Learning Event
  await prisma.learningEvent.create({
    data: {
      userId,
      projectId,
      eventType: "RECOMMENDATIONS_GENERATED",
      payloadJson: JSON.stringify({
        recommendationsCount: recommendations.length,
        weakConceptsCount: weakConcepts.length,
      }),
    },
  });

  return recommendations;
}
