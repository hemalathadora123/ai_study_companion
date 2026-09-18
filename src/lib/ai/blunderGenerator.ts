import { prisma } from "@/lib/db";
import { generateAiResponse } from "./provider";
import { retrieveProjectEvidence } from "./retrieval";
import { awardPoints } from "@/lib/gamification/pointsService";

export interface BlunderStep {
  stepNumber: number;
  label: string;
  mathOrContent: string;
}

export interface BlunderChallenge {
  id: string;
  conceptName: string;
  problemTitle: string;
  problemPrompt: string;
  steps: BlunderStep[];
  blunderStepIndex: number;
  blunderExplanation: string;
  correctStepContent: string;
  pedagogicalTakeaway: string;
}

/**
 * Generates an interactive "Spot the Blunder" challenge.
 * A 3-to-4 step problem derivation containing one subtle, realistic trap.
 */
export async function generateBlunderChallenge(
  projectId: string,
  userId: string
): Promise<BlunderChallenge> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      concepts: {
        include: {
          masteries: { where: { userId } },
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Find target concept (prefer concepts with mistakes or needs attention)
  const targetConcept =
    project.concepts.find(
      (c) => c.masteries[0]?.status === "NEEDS_ATTENTION" || (c.masteries[0]?.masteryScore ?? 100) < 70
    ) || project.concepts[0];

  const conceptName = targetConcept?.name || project.name;

  // Retrieve evidence to ground the blunder challenge
  const retrieval = await retrieveProjectEvidence(projectId, conceptName);
  const evidenceSnippet = retrieval.evidence.slice(0, 2).map((e) => e.content).join("\n\n");

  const systemInstruction = `You are a master educator crafting a "Spot the Blunder" challenge for university students studying "${project.name}".
Create a worked solution to a problem related to "${conceptName}".
The worked solution must have 3 to 4 sequential steps.
EXACTLY ONE step must contain a subtle, commonly made student mistake or algebraic/conceptual blunder.
The other steps must be completely correct and valid.

Output strictly valid JSON with this exact schema:
{
  "problemTitle": "Short descriptive title (e.g., Solving Derivative via Chain Rule)",
  "problemPrompt": "The question or problem to solve",
  "steps": [
    {
      "stepNumber": 1,
      "label": "Step 1: Identify outer and inner functions",
      "mathOrContent": "u = 3x^2 + 1, f(u) = u^3"
    },
    ...
  ],
  "blunderStepIndex": 2, // 0-indexed integer pointing to the flawed step
  "blunderExplanation": "Explain clearly why this step is invalid and what error was committed.",
  "correctStepContent": "The correct working for that step.",
  "pedagogicalTakeaway": "Key lesson so the student never falls into this trap again."
}`;

  const prompt = `TARGET CONCEPT: ${conceptName}
LEARNING GOAL: ${project.learningGoal}
COURSE EVIDENCE:
${evidenceSnippet || "Standard university-level mathematics and principles"}

Generate one high-yield "Spot the Blunder" challenge in valid JSON:`;

  try {
    const aiResult = await generateAiResponse({
      systemInstruction,
      prompt,
      feature: "QUIZ_GENERATION",
      userId,
      metadata: { projectId, conceptName, mode: "SPOT_THE_BLUNDER" },
      temperature: 0.4,
    });

    const cleanJson = aiResult.text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
      id: `blunder-${Date.now()}`,
      conceptName,
      problemTitle: parsed.problemTitle || `Worked Example: ${conceptName}`,
      problemPrompt: parsed.problemPrompt || `Analyze the steps below to find the fallacy in ${conceptName}:`,
      steps: parsed.steps || [],
      blunderStepIndex: Number(parsed.blunderStepIndex) || 1,
      blunderExplanation: parsed.blunderExplanation || "A conceptual fallacy was made in this step.",
      correctStepContent: parsed.correctStepContent || "Refer to foundational definitions.",
      pedagogicalTakeaway: parsed.pedagogicalTakeaway || "Always verify rule assumptions before applying operations.",
    };
  } catch (err) {
    console.warn("Blunder generator fallback:", err);
    return {
      id: `blunder-${Date.now()}`,
      conceptName,
      problemTitle: `Spot the Misconception in ${conceptName}`,
      problemPrompt: `A student attempted to evaluate the derivative of f(x) = (3x^2 + 4)^3:`,
      steps: [
        {
          stepNumber: 1,
          label: "Step 1: Identify inner and outer functions",
          mathOrContent: "Let u = 3x^2 + 4, so f(u) = u^3.",
        },
        {
          stepNumber: 2,
          label: "Step 2: Differentiate outer function",
          mathOrContent: "d/du [u^3] = 3u^2 = 3(3x^2 + 4)^2.",
        },
        {
          stepNumber: 3,
          label: "Step 3: Apply Chain Rule and conclude",
          mathOrContent: "f'(x) = 3(3x^2 + 4)^2  (Forget multiplying by du/dx = 6x).",
        },
      ],
      blunderStepIndex: 2,
      blunderExplanation:
        "The student forgot to multiply by the derivative of the inner function (6x), violating the Chain Rule.",
      correctStepContent: "f'(x) = 3(3x^2 + 4)^2 * (6x) = 18x(3x^2 + 4)^2.",
      pedagogicalTakeaway: "Whenever you substitute u, always remember to multiply by u'!",
    };
  }
}

/**
 * Validates the student's selected blunder step and awards points.
 */
export async function evaluateBlunderAttempt(
  projectId: string,
  userId: string,
  challenge: BlunderChallenge,
  selectedStepIndex: number
) {
  const isCorrect = selectedStepIndex === challenge.blunderStepIndex;

  let pointsAwarded = 0;
  if (isCorrect) {
    try {
      const reward = await awardPoints(userId, "QUIZ_HIGH_SCORE", { projectId });
      pointsAwarded = reward.pointsAwarded || 20;
    } catch (ptsErr) {
      console.warn("Blunder points error:", ptsErr);
    }
  }

  // Record learning event
  try {
    await prisma.learningEvent.create({
      data: {
        userId,
        projectId,
        eventType: "TUTOR_INTERACTED",
        payloadJson: JSON.stringify({
          mode: "SPOT_THE_BLUNDER",
          conceptName: challenge.conceptName,
          isCorrect,
          selectedStep: selectedStepIndex,
        }),
      },
    });
  } catch (evtErr) {
    console.warn("Learning event error:", evtErr);
  }

  return {
    isCorrect,
    correctStepIndex: challenge.blunderStepIndex,
    blunderExplanation: challenge.blunderExplanation,
    correctStepContent: challenge.correctStepContent,
    pedagogicalTakeaway: challenge.pedagogicalTakeaway,
    pointsAwarded,
  };
}
