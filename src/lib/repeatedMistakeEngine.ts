import { prisma } from "@/lib/db";

export interface MisconceptionPattern {
  conceptId: string;
  conceptName: string;
  failureCount: number;
  severity: "REPEATED_MISTAKE" | "CRITICAL_CONFUSION";
  lastMissedAt: Date;
  sampleMissedPrompts: string[];
  remediationMaterialTitle?: string;
  remediationPageNumber?: number;
}

export interface MistakeScanResult {
  projectId: string;
  userId: string;
  detectedPatternsCount: number;
  patterns: MisconceptionPattern[];
  interventionsCreatedCount: number;
}

/**
 * Detects repeated mistake patterns across quizzes and assessments.
 * When a student misses questions on the same concept 2 or more times,
 * automatically generates a targeted, high-priority intervention recommendation.
 */
export async function detectAndRemediateRepeatedMistakes(
  projectId: string,
  userId: string
): Promise<MistakeScanResult> {
  // 1. Fetch all failed quiz attempts for this project and user
  const failedAttempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      quiz: { projectId },
      isCorrect: false,
    },
    include: {
      question: {
        include: {
          concept: true,
        },
      },
    },
    orderBy: { answeredAt: "desc" },
  });

  // 2. Group failures by concept
  const conceptFailureMap = new Map<
    string,
    {
      conceptId: string;
      conceptName: string;
      attempts: typeof failedAttempts;
    }
  >();

  for (const attempt of failedAttempts) {
    const concept = attempt.question.concept;
    if (!concept) continue;

    if (!conceptFailureMap.has(concept.id)) {
      conceptFailureMap.set(concept.id, {
        conceptId: concept.id,
        conceptName: concept.name,
        attempts: [],
      });
    }
    conceptFailureMap.get(concept.id)!.attempts.push(attempt);
  }

  const detectedPatterns: MisconceptionPattern[] = [];
  let interventionsCreated = 0;

  // 3. Evaluate threshold: >= 2 failures indicates a persistent misconception
  for (const [conceptId, data] of conceptFailureMap.entries()) {
    const failureCount = data.attempts.length;
    if (failureCount >= 2) {
      const severity: "REPEATED_MISTAKE" | "CRITICAL_CONFUSION" =
        failureCount >= 3 ? "CRITICAL_CONFUSION" : "REPEATED_MISTAKE";

      // 4. Find grounding source material for targeted remediation
      const matchingChunk = await prisma.documentChunk.findFirst({
        where: {
          projectId,
          material: { status: "READY" },
          OR: [
            { content: { contains: data.conceptName } },
            { concepts: { contains: data.conceptName } },
          ],
        },
        include: { material: { select: { title: true } } },
      });

      const pattern: MisconceptionPattern = {
        conceptId,
        conceptName: data.conceptName,
        failureCount,
        severity,
        lastMissedAt: data.attempts[0].answeredAt,
        sampleMissedPrompts: data.attempts
          .map((a) => a.question.prompt)
          .slice(0, 2),
        remediationMaterialTitle: matchingChunk?.material.title,
        remediationPageNumber: matchingChunk?.pageNumber,
      };

      detectedPatterns.push(pattern);

      // 5. Upsert Targeted Remediation Recommendation
      const interventionTitle = `🚨 Remediation: ${data.conceptName}`;
      const pageReference = pattern.remediationPageNumber
        ? ` (Page ${pattern.remediationPageNumber} of "${pattern.remediationMaterialTitle || "Materials"}")`
        : "";

      const reason = `Persistent misconception detected: You have missed questions on "${data.conceptName}" ${failureCount} times. Review the source explanation${pageReference} before taking your next quiz.`;

      // Check if an uncompleted intervention already exists for this concept
      const existingIntervention = await prisma.recommendation.findFirst({
        where: {
          projectId,
          userId,
          type: "REPEATED_MISTAKE_REMEDIATION",
          title: interventionTitle,
          isCompleted: false,
        },
      });

      if (!existingIntervention) {
        await prisma.recommendation.create({
          data: {
            projectId,
            userId,
            type: "REPEATED_MISTAKE_REMEDIATION",
            title: interventionTitle,
            reason,
            priority: "HIGH",
            targetUrl: `/projects/${projectId}?tab=materials`,
            isCompleted: false,
            isDismissed: false,
          },
        });
        interventionsCreated++;
      }
    }
  }

  // 6. Record learning event if misconceptions were detected
  if (detectedPatterns.length > 0) {
    await prisma.learningEvent.create({
      data: {
        userId,
        projectId,
        eventType: "REPEATED_MISTAKES_DETECTED",
        payloadJson: JSON.stringify({
          detectedPatternsCount: detectedPatterns.length,
          patterns: detectedPatterns.map((p) => ({
            concept: p.conceptName,
            failures: p.failureCount,
            severity: p.severity,
          })),
        }),
      },
    });
  }

  return {
    projectId,
    userId,
    detectedPatternsCount: detectedPatterns.length,
    patterns: detectedPatterns,
    interventionsCreatedCount: interventionsCreated,
  };
}
