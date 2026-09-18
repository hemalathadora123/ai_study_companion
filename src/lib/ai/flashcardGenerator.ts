import { prisma } from "@/lib/db";
import { generateAiResponse } from "./provider";
import { awardPoints } from "@/lib/gamification/pointsService";

export interface GeneratedFlashcardItem {
  id: string;
  projectId: string;
  conceptName?: string | null;
  frontQuestion: string;
  backAnswer: string;
  hint?: string | null;
  sourceCitation?: string | null;
  difficulty: string;
  reviewCount: number;
  masteryLevel: number;
  lastReviewedAt?: Date | null;
  nextReviewDate?: Date | null;
}

/**
 * Generates active-recall flashcards directly grounded in the student's uploaded materials.
 */
export async function generateFlashcardsFromMaterials(
  projectId: string,
  userId: string,
  count: number = 6
): Promise<{ cards: GeneratedFlashcardItem[]; count: number }> {
  // 1. Fetch project with uploaded chunks and materials
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      materials: {
        where: { status: "READY" },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Retrieve substantive document chunks (prioritize chunks with real content over title pages)
  let chunks = await prisma.documentChunk.findMany({
    where: {
      projectId,
      tokenCount: { gte: 25 },
    },
    take: 15,
    include: {
      material: {
        select: { title: true },
      },
    },
    orderBy: { pageNumber: "asc" },
  });

  if (chunks.length === 0) {
    chunks = await prisma.documentChunk.findMany({
      where: { projectId },
      take: 15,
      include: {
        material: {
          select: { title: true },
        },
      },
    });
  }

  if (chunks.length === 0) {
    throw new Error(
      "No processed materials found. Please upload a lecture PDF or notes in the Materials tab first!"
    );
  }

  // 2. Prepare evidence excerpt block with page numbers and document titles
  const evidenceBlock = chunks
    .map(
      (chunk) =>
        `[Document: "${chunk.material.title}" — Page ${chunk.pageNumber}]:\n"${chunk.content}"`
    )
    .join("\n\n");

  const systemInstruction = `You are a world-class study companion and cognitive learning scientist.
Your job is to generate ${count} high-yield, active recall flashcards strictly grounded in the student's provided materials for "${project.name}".

GUIDELINES:
1. QUESTION QUALITY (FRONT):
   - Ask probing, conceptual questions that test understanding of core mechanisms, formulas, laws, or definitions.
   - Avoid trivial regurgitation; ask "Why", "How", or "What is the relationship between X and Y?".
2. ANSWER QUALITY (BACK):
   - Provide clear, direct, and structured explanations (2-4 sentences or bullet points).
   - Explain the core reasoning so the student understands the underlying concept.
3. HINT:
   - Provide an intuitive, memorable clue or mental model without giving away the exact answer.
4. SOURCE CITATION:
   - Conclude each card with the exact document and page where this concept is explained (e.g. "Calculus Notes — Page 4").

Return ONLY valid JSON array matching this exact schema:
[
  {
    "conceptName": "Key Topic or Concept Name",
    "frontQuestion": "Engaging question directly testing understanding of the material",
    "backAnswer": "Authoritative explanation grounded in the text",
    "hint": "Helpful intuition or clue",
    "sourceCitation": "Title of Document — Page N",
    "difficulty": "MEDIUM" // EASY, MEDIUM, or HARD
  }
]`;

  const prompt = `PROJECT LEARNING GOAL:
${project.learningGoal}

STUDENT UPLOADED MATERIAL EXCERPTS:
${evidenceBlock}

Generate ${count} active recall flashcards in JSON format:`;

  let parsedCards: any[] = [];

  try {
    const aiResult = await generateAiResponse({
      systemInstruction,
      prompt,
      feature: "QUIZ_GENERATION",
      userId,
      metadata: {
        projectId,
        projectName: project.name,
        mode: "FLASHCARDS_GENERATION",
        targetCount: count,
        evidenceChunks: chunks.map((c) => ({
          materialTitle: c.material.title,
          pageNumber: c.pageNumber,
          content: c.content,
        })),
      },
      temperature: 0.3,
    });

    const cleanJson = aiResult.text.replace(/```json\n?|\n?```/g, "").trim();
    // In case the AI includes conversational text around the JSON array:
    const jsonMatch = cleanJson.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonToParse = jsonMatch ? jsonMatch[0] : cleanJson;
    parsedCards = JSON.parse(jsonToParse);
  } catch (err) {
    console.warn("Flashcard AI generation fallback:", err);
  }

  // 3. Persist generated flashcards into database
  const createdCards: GeneratedFlashcardItem[] = [];

  if (Array.isArray(parsedCards)) {
    for (const raw of parsedCards) {
      const frontQuestion = (
        raw.frontQuestion ||
        raw.question ||
        raw.prompt ||
        ""
      ).trim();

      const backAnswer = (
        raw.backAnswer ||
        raw.answer ||
        raw.explanation ||
        raw.rubric?.sampleGoodAnswer ||
        ""
      ).trim();

      if (!frontQuestion || !backAnswer) continue;

      const created = await prisma.flashcard.create({
        data: {
          projectId,
          userId,
          conceptName: raw.conceptName || project.name,
          frontQuestion,
          backAnswer,
          hint: raw.hint?.trim() || null,
          sourceCitation:
            raw.sourceCitation?.trim() ||
            `${chunks[0]?.material.title || project.name} — Page ${chunks[0]?.pageNumber || 1}`,
          difficulty: raw.difficulty || "MEDIUM",
          masteryLevel: 0,
          reviewCount: 0,
        },
      });

      createdCards.push(created);
    }
  }

  // Safety net: If AI generation or parsing produced 0 cards, generate directly from chunks
  if (createdCards.length === 0 && chunks.length > 0) {
    const fallbackSlice = chunks.slice(0, count);
    for (let i = 0; i < fallbackSlice.length; i++) {
      const chunk = fallbackSlice[i];
      const docTitle = chunk.material.title;
      const pageNum = chunk.pageNumber;
      const cleanContent = chunk.content.replace(/\s+/g, " ").trim();
      const sentences = cleanContent
        .split(/(?<=[.?!])\s+/)
        .filter((s) => s.length > 25 && !s.includes("Copyright") && !s.includes("ISBN"));

      const firstSentence = sentences[0] || cleanContent.slice(0, 160);
      const secondSentence = sentences[1] || "";
      const backText = `${firstSentence} ${secondSentence}`.trim() || cleanContent.slice(0, 240);

      const created = await prisma.flashcard.create({
        data: {
          projectId,
          userId,
          conceptName: `${project.name} - Concept ${i + 1}`,
          frontQuestion: `What is the core principle or mechanism explained on Page ${pageNum} of "${docTitle}"?`,
          backAnswer: backText,
          hint: `Refer to Page ${pageNum} of ${docTitle}.`,
          sourceCitation: `${docTitle} — Page ${pageNum}`,
          difficulty: i % 2 === 0 ? "MEDIUM" : "EASY",
          masteryLevel: 0,
          reviewCount: 0,
        },
      });

      createdCards.push(created);
    }
  }

  // 4. Emit Learning Event
  try {
    await prisma.learningEvent.create({
      data: {
        userId,
        projectId,
        eventType: "TUTOR_INTERACTED",
        payloadJson: JSON.stringify({
          mode: "FLASHCARDS_GENERATED",
          count: createdCards.length,
        }),
      },
    });
  } catch (evtErr) {
    console.warn("Flashcards learning event error:", evtErr);
  }

  return {
    cards: createdCards,
    count: createdCards.length,
  };
}

/**
 * Updates a flashcard review status using spaced repetition (Leitner system).
 */
export async function reviewFlashcard(
  cardId: string,
  rating: "AGAIN" | "GOOD" | "EASY",
  userId: string
) {
  const card = await prisma.flashcard.findUnique({
    where: { id: cardId },
  });

  if (!card || card.userId !== userId) {
    throw new Error("Flashcard not found or unauthorized");
  }

  let newMasteryLevel = card.masteryLevel;
  let intervalDays = 1;

  if (rating === "AGAIN") {
    newMasteryLevel = Math.max(0, card.masteryLevel - 1);
    intervalDays = 1;
  } else if (rating === "GOOD") {
    newMasteryLevel = Math.min(5, card.masteryLevel + 1);
    intervalDays = Math.max(2, newMasteryLevel * 2);
  } else if (rating === "EASY") {
    newMasteryLevel = Math.min(5, card.masteryLevel + 2);
    intervalDays = Math.max(4, newMasteryLevel * 3);
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  const updated = await prisma.flashcard.update({
    where: { id: cardId },
    data: {
      reviewCount: card.reviewCount + 1,
      masteryLevel: newMasteryLevel,
      lastReviewedAt: new Date(),
      nextReviewDate,
    },
  });

  // Award gamification points
  let pointsAwarded = 10;
  if (rating === "EASY") pointsAwarded = 20;

  try {
    await awardPoints(userId, "TUTOR_QUESTION", {
      projectId: card.projectId,
    });
  } catch (ptsErr) {
    console.warn("Points award error for flashcard review:", ptsErr);
  }

  return {
    card: updated,
    pointsAwarded,
    newMasteryLevel,
  };
}
