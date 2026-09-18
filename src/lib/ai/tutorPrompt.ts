import { prisma } from "@/lib/db";
import { retrieveProjectEvidence, RetrievedEvidence } from "./retrieval";
import { generateAiResponse } from "./provider";

export interface Citation {
  materialId: string;
  title: string;
  pageNumber: number;
  snippet?: string;
}

export interface TutorResponseResult {
  messageId: string;
  content: string;
  citations: Citation[];
  isUngrounded: boolean;
  latencyMs: number;
  tokensUsed: number;
}

/**
 * Executes a Grounded AI Tutor interaction:
 * 1. Retrieves project-scoped evidence
 * 2. Gates against insufficient evidence
 * 3. Composes contextual prompt with learning goals and mastery levels
 * 4. Generates grounded answer with exact page citations
 * 5. Persists messages and records learning telemetry
 */
export async function executeTutorTurn(
  projectId: string,
  userId: string,
  conversationId: string,
  userQuestion: string
): Promise<TutorResponseResult> {
  const startTime = Date.now();

  // 1. Fetch Project & Learner Context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      conceptMasteries: {
        where: { userId },
        include: { concept: true },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Identify weak concepts (< 60% mastery) for pedagogical adaptation
  const weakConcepts = project.conceptMasteries
    .filter((m) => m.masteryScore < 60)
    .map((m) => m.concept.name);

  // 2. Retrieve Project Evidence (Scoped RAG)
  const retrieval = await retrieveProjectEvidence(projectId, userQuestion);

  // 3. Save User Message
  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: userQuestion.trim(),
    },
  });

  // 4. Grounding Gate: Check Evidence Sufficiency
  if (!retrieval.hasSufficientEvidence) {
    const ungroundedContent =
      "Based on the learning materials currently uploaded for this project, there is insufficient evidence to answer this question reliably. To maintain accurate learning, I only explain topics backed by your project documents. Please upload relevant notes or chapters to explore this topic together!";

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: ungroundedContent,
        citationsJson: null,
        isUngrounded: true,
        latencyMs: Date.now() - startTime,
        tokenCount: 45,
      },
    });

    // Record learning event
    await prisma.learningEvent.create({
      data: {
        userId,
        projectId,
        eventType: "TUTOR_INTERACTED",
        payloadJson: JSON.stringify({
          conversationId,
          isUngrounded: true,
          question: userQuestion,
        }),
      },
    });

    return {
      messageId: assistantMessage.id,
      content: ungroundedContent,
      citations: [],
      isUngrounded: true,
      latencyMs: Date.now() - startTime,
      tokensUsed: 45,
    };
  }

  // 5. Compose Grounded Context Prompt
  const evidencePromptBlock = retrieval.evidence
    .map(
      (ev) =>
        `[Source: "${ev.materialTitle}" — Page ${ev.pageNumber}]:\n"${ev.content}"`
    )
    .join("\n\n");

  const systemInstruction = `You are an expert, inspiring, and supportive teacher tutoring a student on "${project.name}".
Your teaching objective is to guide the student to deep conceptual mastery of: "${project.learningGoal}".
Learner Background: Needs special clarity on: [${weakConcepts.join(", ") || "Foundational principles"}].

ROLE & TEACHING STYLE GUIDELINES:
1. TEACH LIKE AN INSPIRING PROFESSOR:
   - Talk directly to the student in a warm, encouraging, and clear conversational voice.
   - Do NOT just quote excerpts, summarize citations, or say "According to page X...". The student wants you to actually TEACH and EXPLAIN the concept to them!
   - Start with an intuitive, relatable analogy or mental model so the student grasps the big picture immediately.

2. STRUCTURED, STEP-BY-STEP EXPLANATION:
   - Break down complex mechanisms, formulas, or ideas into clear steps (like walking through it on a classroom whiteboard).
   - Unpack any technical jargon, variables, or definitions in simple, intuitive terms.
   - Show *why* the concept works the way it does, not just *what* it is.

3. PRACTICAL EXAMPLE & KEY TAKEAWAY:
   - Walk through a concrete scenario or intuitive example showing how this concept works.
   - Give a quick, memorable summary of the core insight so the student walks away confident.

4. STRICT GROUNDING:
   - Base your conceptual explanations firmly on the provided Project Evidence.
   - Do not invent unsupported claims outside what the course material covers.

5. TRANSPARENT REFERENCE:
   - Conclude your explanation with a polite reference line:
     "Source: [Material Title] — Page [Page Number]"

6. PROBLEM SOLVING & MATHEMATICS:
   - When the student asks to solve a problem, find a derivative, calculate an answer, or work through a mathematical equation (e.g. 'Find the derivative of f(x) = 3x^2 + 4x - 2'):
   - Actively solve the problem step-by-step with complete whiteboard calculations.
   - Name and explain the mathematical rules applied at each step (e.g. Power Rule, Product Rule, Chain Rule, Sum Rule).
   - Clearly state and highlight the final answer in bold.
   - Explain the geometrical or physical intuition behind the result (such as tangent slopes or critical points).`;

  const prompt = `PROJECT EVIDENCE CHUNKS:
${evidencePromptBlock}

STUDENT'S QUESTION:
${userQuestion}

Please address the student's question or solve the mathematical problem step-by-step in an engaging, supportive teacher style, grounded in the principles and materials above:`;

  // 6. Generate AI Response
  const aiResult = await generateAiResponse({
    systemInstruction,
    prompt,
    feature: "TUTOR",
    userId,
    metadata: {
      projectId,
      conversationId,
      retrievedChunksCount: retrieval.evidence.length,
      userQuestion,
      projectName: project.name,
      learningGoal: project.learningGoal,
      weakConcepts,
      evidence: retrieval.evidence.map((ev) => ({
        materialTitle: ev.materialTitle,
        pageNumber: ev.pageNumber,
        content: ev.content,
      })),
    },
  });

  // 7. Format Citations Array
  const citations: Citation[] = retrieval.evidence.map((ev) => ({
    materialId: ev.materialId,
    title: ev.materialTitle,
    pageNumber: ev.pageNumber,
    snippet: ev.content.slice(0, 160),
  }));

  // 8. Save Assistant Message
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: aiResult.text,
      citationsJson: JSON.stringify(citations),
      isUngrounded: false,
      latencyMs: aiResult.latencyMs,
      tokenCount: aiResult.totalTokens,
    },
  });

  // 9. Update Conversation timestamp & Emit Learning Event
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  await prisma.learningEvent.create({
    data: {
      userId,
      projectId,
      eventType: "TUTOR_INTERACTED",
      payloadJson: JSON.stringify({
        conversationId,
        isUngrounded: false,
        citationsCount: citations.length,
        tokensUsed: aiResult.totalTokens,
      }),
    },
  });

  return {
    messageId: assistantMessage.id,
    content: aiResult.text,
    citations,
    isUngrounded: false,
    latencyMs: aiResult.latencyMs,
    tokensUsed: aiResult.totalTokens,
  };
}
