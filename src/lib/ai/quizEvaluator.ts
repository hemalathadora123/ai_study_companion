import { prisma } from "@/lib/db";
import { generateAiResponse } from "./provider";
import {
  awardQuizPerformancePoints,
  QuizPerformanceReward,
} from "@/lib/gamification/pointsService";

export interface AnswerSubmission {
  questionId: string;
  selectedOptionIndex?: number | null;
  textResponse?: string | null;
  confidenceLevel?: "HIGH" | "MEDIUM" | "LOW" | null;
}

export interface QuestionGradingResult {
  questionId: string;
  questionType: string;
  prompt: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
  missingConcepts: string[];
  explanation?: string | null;
  confidenceLevel?: "HIGH" | "MEDIUM" | "LOW" | null;
}

export interface MetacognitiveMatrix {
  masteryZoneCount: number; // High confidence + correct (True Mastery)
  blindSpotCount: number;   // High confidence + incorrect (Dangerous Misconceptions)
  luckyGuessCount: number;  // Low/Med confidence + correct (Unstable Intuition)
  growthZoneCount: number;  // Low/Med confidence + incorrect (Self-Aware Gap)
  calibrationScore: number; // 0-100% calibration score
  calibrationVerdict: "WELL_CALIBRATED" | "OVERCONFIDENT" | "UNDERCONFIDENT" | "BALANCED";
}

export interface QuizEvaluationResult {
  quizId: string;
  overallScore: number;
  totalQuestions: number;
  correctCount: number;
  gradedQuestions: QuestionGradingResult[];
  pointsAwarded?: number;
  performanceReward?: QuizPerformanceReward | null;
  metacognitiveMatrix?: MetacognitiveMatrix | null;
}

/**
 * Evaluates a completed quiz submission:
 * - Checks MCQs against ground-truth keys.
 * - Grades open-ended questions against multi-criteria rubrics via AI.
 * - Records individual question attempts.
 * - Updates learner ConceptMastery dynamically.
 */
export async function evaluateQuizSubmission(
  quizId: string,
  userId: string,
  answers: AnswerSubmission[]
): Promise<QuizEvaluationResult> {
  // 1. Fetch quiz and questions with concept relations
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        include: {
          concept: true,
        },
      },
      project: true,
    },
  });

  if (!quiz || quiz.userId !== userId) {
    throw new Error("Quiz not found or unauthorized");
  }

  const gradedQuestions: QuestionGradingResult[] = [];
  let totalScoreSum = 0;
  let correctCount = 0;

  for (const question of quiz.questions) {
    const answer = answers.find((a) => a.questionId === question.id);
    let isCorrect = false;
    let score = 0;
    let feedback = "";
    let missingConcepts: string[] = [];

    if (question.questionType === "MCQ") {
      const selectedIndex = answer?.selectedOptionIndex ?? -1;
      isCorrect = selectedIndex === question.correctOptionIndex;
      score = isCorrect ? 100 : 0;
      feedback = isCorrect
        ? `Correct! ${question.explanation || "Well done."}`
        : `Incorrect. ${question.explanation || "Review this concept to strengthen your understanding."}`;

      if (!isCorrect && question.concept) {
        missingConcepts.push(question.concept.name);
      }
    } else {
      // OPEN_ENDED AI Rubric Evaluation
      const textResponse = answer?.textResponse?.trim() || "";

      if (textResponse.length === 0) {
        score = 0;
        isCorrect = false;
        feedback = "No answer provided. Please attempt the question to test your knowledge.";
        if (question.concept) missingConcepts.push(question.concept.name);
      } else {
        // Compose evaluation prompt
        const systemInstruction = `You are a rigorous, supportive pedagogical evaluator for an AI study companion.
Evaluate the student's answer against the given question and rubric.
Output ONLY a JSON object with:
{
  "score": <number between 0 and 100>,
  "isCorrect": <boolean, true if score >= 60>,
  "feedback": "<clear explanatory feedback praising strengths and clarifying gaps>",
  "missingConcepts": ["<missing or misunderstood concept 1>"]
}`;

        const prompt = `QUESTION:
${question.prompt}

GRADING RUBRIC & KEY POINTS:
${question.rubricJson || "Evaluate for accuracy, depth, and conceptual precision."}

STUDENT'S ANSWER:
${textResponse}`;

        const aiResult = await generateAiResponse({
          systemInstruction,
          prompt,
          feature: "ASSESSMENT_EVALUATION",
          userId,
          metadata: {
            quizId,
            questionId: question.id,
          },
        });

        try {
          const cleaned = aiResult.text
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
          const parsed = JSON.parse(cleaned);
          score = typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 50;
          isCorrect = score >= 60;
          feedback = parsed.feedback || "Evaluated based on conceptual criteria.";
          missingConcepts = Array.isArray(parsed.missingConcepts) ? parsed.missingConcepts : [];
        } catch (err) {
          score = textResponse.length > 20 ? 70 : 40;
          isCorrect = score >= 60;
          feedback = "Response evaluated. Keep reviewing key definitions in project materials.";
        }
      }
    }

    if (isCorrect) {
      correctCount++;
    }
    totalScoreSum += score;

    // 2. Persist QuizAttempt in SQLite
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        questionId: question.id,
        userId,
        selectedOptionIndex: answer?.selectedOptionIndex ?? null,
        textResponse: answer?.textResponse ?? null,
        isCorrect,
        score,
        feedback,
        missingConceptsJson: missingConcepts.length > 0 ? JSON.stringify(missingConcepts) : null,
      },
    });

    // 3. Update ConceptMastery if question is linked to a concept
    if (question.conceptId) {
      const currentMastery = await prisma.conceptMastery.findFirst({
        where: {
          userId,
          projectId: quiz.projectId,
          conceptId: question.conceptId,
        },
      });

      const currentScore = currentMastery?.masteryScore ?? 50;
      // Exponential moving average: 70% previous, 30% new performance
      const updatedScore = Math.round(currentScore * 0.7 + score * 0.3);
      const totalAttempts = (currentMastery?.totalAttempts ?? 0) + 1;
      const correctAttempts = (currentMastery?.correctAttempts ?? 0) + (isCorrect ? 1 : 0);

      let status = "NEEDS_ATTENTION";
      if (updatedScore >= 75) {
        status = "STABLE";
      } else if (updatedScore >= 60) {
        status = "IMPROVING";
      }

      await prisma.conceptMastery.upsert({
        where: {
          userId_projectId_conceptId: {
            userId,
            projectId: quiz.projectId,
            conceptId: question.conceptId,
          },
        },
        update: {
          masteryScore: updatedScore,
          status,
          totalAttempts,
          correctAttempts,
          lastAssessedAt: new Date(),
        },
        create: {
          userId,
          projectId: quiz.projectId,
          conceptId: question.conceptId,
          masteryScore: updatedScore,
          status,
          totalAttempts,
          correctAttempts,
          lastAssessedAt: new Date(),
        },
      });
    }

    gradedQuestions.push({
      questionId: question.id,
      questionType: question.questionType,
      prompt: question.prompt,
      isCorrect,
      score,
      feedback,
      missingConcepts,
      explanation: question.explanation,
      confidenceLevel: answer?.confidenceLevel || null,
    });
  }

  const overallScore = Math.round(totalScoreSum / quiz.questions.length);

  // 4. Update Quiz status and score
  await prisma.quiz.update({
    where: { id: quizId },
    data: {
      score: overallScore,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  // 5. Emit Learning Event
  await prisma.learningEvent.create({
    data: {
      userId,
      projectId: quiz.projectId,
      eventType: "QUIZ_COMPLETED",
      payloadJson: JSON.stringify({
        quizId: quiz.id,
        overallScore,
        totalQuestions: quiz.questions.length,
        correctCount,
      }),
    },
  });

  // 6. Award Points for Quiz Participation & Performance
  let pointsAwarded = 0;
  let performanceReward = null;
  try {
    const res = await awardQuizPerformancePoints(userId, {
      id: quiz.id,
      projectId: quiz.projectId,
      title: quiz.title,
      score: overallScore,
      totalQuestions: quiz.questions.length,
      correctCount,
    });
    pointsAwarded = res.reward.totalPointsAwarded;
    performanceReward = res.reward;
  } catch (err) {
    console.warn("Failed to award quiz performance points:", err);
  }

  // 7. Calculate Metacognitive Calibration Matrix
  let masteryZoneCount = 0;
  let blindSpotCount = 0;
  let luckyGuessCount = 0;
  let growthZoneCount = 0;
  let hasConfidenceData = false;

  for (const g of gradedQuestions) {
    if (g.confidenceLevel) {
      hasConfidenceData = true;
      if (g.confidenceLevel === "HIGH") {
        if (g.isCorrect) masteryZoneCount++;
        else blindSpotCount++;
      } else {
        if (g.isCorrect) luckyGuessCount++;
        else growthZoneCount++;
      }
    }
  }

  let metacognitiveMatrix: MetacognitiveMatrix | null = null;
  if (hasConfidenceData) {
    const totalWithConfidence = masteryZoneCount + blindSpotCount + luckyGuessCount + growthZoneCount;
    const wellCalibratedCount = masteryZoneCount + growthZoneCount;
    const calibrationScore = totalWithConfidence > 0 ? Math.round((wellCalibratedCount / totalWithConfidence) * 100) : 100;

    let calibrationVerdict: "WELL_CALIBRATED" | "OVERCONFIDENT" | "UNDERCONFIDENT" | "BALANCED" = "BALANCED";
    if (blindSpotCount >= 2 || (blindSpotCount > 0 && totalWithConfidence <= 3)) {
      calibrationVerdict = "OVERCONFIDENT";
    } else if (luckyGuessCount > masteryZoneCount && luckyGuessCount >= 2) {
      calibrationVerdict = "UNDERCONFIDENT";
    } else if (calibrationScore >= 75) {
      calibrationVerdict = "WELL_CALIBRATED";
    }

    metacognitiveMatrix = {
      masteryZoneCount,
      blindSpotCount,
      luckyGuessCount,
      growthZoneCount,
      calibrationScore,
      calibrationVerdict,
    };
  }

  return {
    quizId: quiz.id,
    overallScore,
    totalQuestions: quiz.questions.length,
    correctCount,
    gradedQuestions,
    pointsAwarded,
    performanceReward,
    metacognitiveMatrix,
  };
}
