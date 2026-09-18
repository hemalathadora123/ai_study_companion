import { prisma } from "@/lib/db";
import { generateAiResponse } from "./provider";

export interface GeneratedQuestionPayload {
  conceptName: string;
  questionType: "MCQ" | "OPEN_ENDED";
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  rubric?: {
    keyPoints: string[];
    criteria: string;
    sampleGoodAnswer: string;
  };
  explanation?: string;
}

export interface GenerateQuizResult {
  quizId: string;
  title: string;
  totalQuestions: number;
  targetedConcepts: string[];
}

/**
 * Generates an adaptive quiz tailored to the learner's current mastery levels and weak concepts.
 * Pulls evidence chunks from project materials to ensure grounded questions.
 */
export async function generateAdaptiveQuiz(
  projectId: string,
  userId: string,
  questionCount: number = 3
): Promise<GenerateQuizResult> {
  // 1. Fetch project with concepts and learner mastery
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
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // 2. Classify concepts into weak/unmastered vs stable
  const weakConcepts: { id: string; name: string; score: number }[] = [];
  const stableConcepts: { id: string; name: string; score: number }[] = [];

  for (const concept of project.concepts) {
    const mastery = concept.masteries[0];
    const score = mastery ? mastery.masteryScore : 0;
    if (score < 60) {
      weakConcepts.push({ id: concept.id, name: concept.name, score });
    } else {
      stableConcepts.push({ id: concept.id, name: concept.name, score });
    }
  }

  // Choose target concepts (prioritize weak ones, balance with stable)
  const targetConcepts = [
    ...weakConcepts.slice(0, Math.ceil(questionCount * 0.7)),
    ...stableConcepts.slice(0, Math.floor(questionCount * 0.3)),
  ];

  if (targetConcepts.length === 0 && project.concepts.length > 0) {
    targetConcepts.push(
      ...project.concepts.slice(0, questionCount).map((c) => ({
        id: c.id,
        name: c.name,
        score: 50,
      }))
    );
  }

  const targetedConceptNames = targetConcepts.map((c) => c.name);

  // 3. Fetch evidence chunks for context grounding
  // Prioritize chunks that contain target concepts and have substantive content (skip front-matter)
  let chunks: { pageNumber: number; content: string; material: { title: string } }[] = [];

  if (targetedConceptNames.length > 0) {
    const conceptChunks = await prisma.documentChunk.findMany({
      where: {
        projectId,
        material: { status: "READY" },
        tokenCount: { gte: 20 },
        OR: targetedConceptNames.map((name) => ({
          content: { contains: name.slice(0, 25) },
        })),
      },
      take: 6,
      select: {
        pageNumber: true,
        content: true,
        material: { select: { title: true } },
      },
    });
    chunks = [...conceptChunks];
  }

  // If fewer than 4 chunks found, fetch substantive chunks from throughout the material
  if (chunks.length < 4) {
    const generalChunks = await prisma.documentChunk.findMany({
      where: {
        projectId,
        material: { status: "READY" },
        tokenCount: { gte: 30 },
        pageNumber: { gte: 4 },
      },
      take: 6 - chunks.length,
      select: {
        pageNumber: true,
        content: true,
        material: { select: { title: true } },
      },
    });
    chunks = [...chunks, ...generalChunks];
  }

  // Fallback if document has few pages
  if (chunks.length === 0) {
    chunks = await prisma.documentChunk.findMany({
      where: {
        projectId,
        material: { status: "READY" },
      },
      take: 5,
      select: {
        pageNumber: true,
        content: true,
        material: { select: { title: true } },
      },
    });
  }

  const cleanChunks = chunks.map((c) => ({
    materialTitle: c.material.title,
    pageNumber: c.pageNumber,
    content: c.content.replace(/\s+/g, " ").trim(),
  }));

  const evidenceBlock = cleanChunks
    .map(
      (c) =>
        `[Document: "${c.materialTitle}" — Page ${c.pageNumber}]:\n${c.content.slice(0, 450)}`
    )
    .join("\n\n");

  // 4. Construct AI prompt
  const systemInstruction = `You are an expert adaptive quiz generator for an AI study companion.
Your goal is to test the student on concepts from project: "${project.name}" (Goal: "${project.learningGoal}").
You must ground questions strictly in the provided project context.
Output ONLY a JSON array of ${questionCount} questions. No introduction or extra markdown formatting.`;

  const prompt = `PROJECT CONTEXT & SOURCE EVIDENCE:
${evidenceBlock || "General project domain materials."}

TARGET CONCEPTS TO TEST (Prioritize weak areas):
${targetedConceptNames.length > 0 ? targetedConceptNames.join(", ") : "Core project fundamentals"}

QUESTION REQUIREMENTS:
Generate a mix of MCQ (Multiple Choice) and OPEN_ENDED questions (e.g. 2 MCQs and 1 OPEN_ENDED).

JSON FORMAT SCHEMA:
[
  {
    "conceptName": "Name of concept tested",
    "questionType": "MCQ",
    "prompt": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOptionIndex": 0,
    "explanation": "Why this option is correct based on the material."
  },
  {
    "conceptName": "Name of concept tested",
    "questionType": "OPEN_ENDED",
    "prompt": "Conceptual or analytical question requiring deep understanding.",
    "rubric": {
      "keyPoints": ["Must-have concept 1", "Must-have concept 2"],
      "criteria": "Scoring criteria for full marks.",
      "sampleGoodAnswer": "Exemplar concise answer."
    },
    "explanation": "Key aspects of a complete response."
  }
]`;

  // 5. Call AI Provider
  const aiResult = await generateAiResponse({
    systemInstruction,
    prompt,
    feature: "QUIZ_GENERATION",
    userId,
    metadata: {
      projectId,
      projectName: project.name,
      learningGoal: project.learningGoal,
      targetConcepts: targetedConceptNames,
      questionCount,
      evidenceChunks: cleanChunks,
    },
  });

  // 6. Parse JSON safely
  let generatedQuestions: GeneratedQuestionPayload[] = [];
  try {
    const cleanedText = aiResult.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    generatedQuestions = JSON.parse(cleanedText);
  } catch (err) {
    console.error("Failed to parse quiz generator response as JSON:", aiResult.text);
    // Dynamic material-grounded fallback question if parsing failed
    const primaryConcept = targetedConceptNames[0] || project.concepts[0]?.name || "Core Subject Principles";
    const primaryChunk = cleanChunks[0];
    const sourceTitle = primaryChunk?.materialTitle || project.name;
    const pageRef = primaryChunk ? ` (Page ${primaryChunk.pageNumber})` : "";
    const keySnippet = primaryChunk?.content
      ? primaryChunk.content.slice(0, 150).replace(/\s+/g, " ")
      : `Core principles of ${project.name}`;

    generatedQuestions = [
      {
        conceptName: primaryConcept,
        questionType: "MCQ",
        prompt: `Based on the study materials in "${sourceTitle}"${pageRef}, which statement accurately describes ${primaryConcept}?`,
        options: [
          keySnippet.length > 25 ? `${keySnippet}.` : `It represents the fundamental mechanism governing ${primaryConcept}.`,
          `It operates completely independently of ${project.learningGoal || "the course curriculum"}.`,
          `It has been demonstrated to be an invalid theoretical formulation.`,
          `It applies only under strictly non-standard experimental conditions.`
        ],
        correctOptionIndex: 0,
        explanation: `Grounded reference from "${sourceTitle}"${pageRef}: "${keySnippet}..."`
      }
    ];
  }

  // 7. Persist Quiz and Questions in Database
  const quizTitle = `Adaptive Assessment: ${targetedConceptNames.slice(0, 2).join(" & ") || "Comprehensive"}`;

  const quiz = await prisma.quiz.create({
    data: {
      projectId,
      userId,
      title: quizTitle,
      status: "IN_PROGRESS",
      totalQuestions: generatedQuestions.length,
      difficultyLevel: "ADAPTIVE",
    },
  });

  for (const q of generatedQuestions) {
    // Match conceptId if available
    const matchedConcept = project.concepts.find(
      (c) => c.name.toLowerCase() === q.conceptName?.toLowerCase()
    );

    await prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        conceptId: matchedConcept?.id || project.concepts[0]?.id || null,
        questionType: q.questionType,
        prompt: q.prompt,
        optionsJson: q.options ? JSON.stringify(q.options) : null,
        correctOptionIndex: q.correctOptionIndex ?? null,
        rubricJson: q.rubric ? JSON.stringify(q.rubric) : null,
        explanation: q.explanation || null,
      },
    });
  }

  // 8. Record learning event
  await prisma.learningEvent.create({
    data: {
      userId,
      projectId,
      eventType: "QUIZ_GENERATED",
      payloadJson: JSON.stringify({
        quizId: quiz.id,
        questionsCount: generatedQuestions.length,
        targetedConcepts: targetedConceptNames,
      }),
    },
  });

  return {
    quizId: quiz.id,
    title: quizTitle,
    totalQuestions: generatedQuestions.length,
    targetedConcepts: targetedConceptNames,
  };
}
