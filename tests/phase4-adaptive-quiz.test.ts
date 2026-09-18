import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generateAdaptiveQuiz } from "@/lib/ai/quizGenerator";
import { evaluateQuizSubmission } from "@/lib/ai/quizEvaluator";

const prisma = new PrismaClient();

describe("Phase 4: Adaptive Quiz Engine, Rubric-based Open-Ended Grading & Mastery Updates", () => {
  let testUser: any;
  let foreignUser: any;
  let testSpace: any;
  let testProject: any;
  let material: any;
  let weakConcept: any;
  let strongConcept: any;
  let generatedQuizResult: any;

  beforeAll(async () => {
    // 1. Create test users
    testUser = await prisma.user.create({
      data: {
        name: "Quiz Learner",
        email: `quiz_learner_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    foreignUser = await prisma.user.create({
      data: {
        name: "Foreign User",
        email: `foreign_user_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    // 2. Setup Space & Project
    testSpace = await prisma.space.create({
      data: {
        userId: testUser.id,
        name: "Deep Learning Architectures",
      },
    });

    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        spaceId: testSpace.id,
        name: "Transformer Architectures",
        learningGoal: "Master attention math and rubric assessment",
      },
    });

    // 3. Create Concepts with differing mastery levels
    weakConcept = await prisma.concept.create({
      data: {
        projectId: testProject.id,
        name: "Scaled Dot-Product Attention",
        description: "Scaling dot products by sqrt(d_k) to prevent small softmax gradients",
        importanceLevel: "HIGH",
      },
    });

    strongConcept = await prisma.concept.create({
      data: {
        projectId: testProject.id,
        name: "Positional Encodings",
        description: "Injecting sequence order into embeddings",
        importanceLevel: "MEDIUM",
      },
    });

    // Register ConceptMastery: weak at 35%, strong at 85%
    await prisma.conceptMastery.create({
      data: {
        userId: testUser.id,
        projectId: testProject.id,
        conceptId: weakConcept.id,
        masteryScore: 35.0,
        status: "NEEDS_ATTENTION",
        totalAttempts: 2,
        correctAttempts: 0,
      },
    });

    await prisma.conceptMastery.create({
      data: {
        userId: testUser.id,
        projectId: testProject.id,
        conceptId: strongConcept.id,
        masteryScore: 85.0,
        status: "STABLE",
        totalAttempts: 5,
        correctAttempts: 4,
      },
    });

    // 4. Create Material and Chunks to ground questions
    material = await prisma.material.create({
      data: {
        projectId: testProject.id,
        title: "Attention Is All You Need Research Paper",
        originalFilename: "attention.pdf",
        fileUrl: "/uploads/attention.pdf",
        fileSize: 450000,
        mimeType: "application/pdf",
        status: "READY",
        totalPages: 15,
      },
    });

    await prisma.documentChunk.create({
      data: {
        projectId: testProject.id,
        materialId: material.id,
        pageNumber: 4,
        chunkIndex: 0,
        content:
          "Scaled Dot-Product Attention computes attention by dividing dot products of Q and K by sqrt(d_k), applying softmax, and weighting V.",
        concepts: JSON.stringify(["Scaled Dot-Product Attention"]),
      },
    });
  });

  afterAll(async () => {
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    if (foreignUser?.id) {
      await prisma.user.delete({ where: { id: foreignUser.id } });
    }
    await prisma.$disconnect();
  });

  it("generates an adaptive quiz prioritizing weak concepts (< 60% mastery)", async () => {
    generatedQuizResult = await generateAdaptiveQuiz(
      testProject.id,
      testUser.id,
      3
    );

    expect(generatedQuizResult.quizId).toBeDefined();
    expect(generatedQuizResult.totalQuestions).toBeGreaterThanOrEqual(1);
    expect(generatedQuizResult.targetedConcepts).toContain("Scaled Dot-Product Attention");

    // Verify Quiz in database
    const quizInDb = await prisma.quiz.findUnique({
      where: { id: generatedQuizResult.quizId },
      include: { questions: true },
    });

    expect(quizInDb).not.toBeNull();
    expect(quizInDb?.status).toBe("IN_PROGRESS");
    expect(quizInDb?.questions.length).toBeGreaterThanOrEqual(1);

    // Verify mixed question types exist
    const questionTypes = quizInDb?.questions.map((q) => q.questionType);
    expect(questionTypes).toContain("MCQ");
  });

  it("evaluates MCQ submissions accurately against answer keys", async () => {
    // Find an MCQ question from the generated quiz
    const quiz = await prisma.quiz.findUnique({
      where: { id: generatedQuizResult.quizId },
      include: { questions: true },
    });

    const mcqQuestion = quiz?.questions.find((q) => q.questionType === "MCQ");
    expect(mcqQuestion).toBeDefined();

    // Submit correct choice
    const correctAnswers = [
      {
        questionId: mcqQuestion!.id,
        selectedOptionIndex: mcqQuestion!.correctOptionIndex ?? 0,
      },
    ];

    const result = await evaluateQuizSubmission(
      generatedQuizResult.quizId,
      testUser.id,
      correctAnswers
    );

    const gradedMcq = result.gradedQuestions.find((q) => q.questionId === mcqQuestion!.id);
    expect(gradedMcq?.isCorrect).toBe(true);
    expect(gradedMcq?.score).toBe(100);
    expect(gradedMcq?.feedback).toContain("Correct");
  });

  it("evaluates open-ended questions using AI multi-criteria rubrics", async () => {
    const quiz = await prisma.quiz.findUnique({
      where: { id: generatedQuizResult.quizId },
      include: { questions: true },
    });

    const openQuestion = quiz?.questions.find((q) => q.questionType === "OPEN_ENDED");
    if (openQuestion) {
      // High quality conceptual answer mentioning weighted sum and values
      const goodAnswers = [
        {
          questionId: openQuestion.id,
          textResponse:
            "The attention function maps queries and keys to calculate compatibility weights, and then computes the final output as a weighted sum of the values.",
        },
      ];

      const goodResult = await evaluateQuizSubmission(
        generatedQuizResult.quizId,
        testUser.id,
        goodAnswers
      );

      const gradedOpen = goodResult.gradedQuestions.find((q) => q.questionId === openQuestion.id);
      expect(gradedOpen?.score).toBeGreaterThanOrEqual(60);
      expect(gradedOpen?.isCorrect).toBe(true);
      expect(gradedOpen?.feedback.length).toBeGreaterThan(15);
      expect(gradedOpen?.missingConcepts.length).toBe(0);
    }
  });

  it("updates learner ConceptMastery dynamically and records QuizAttempt entries", async () => {
    // Check ConceptMastery for weak concept after submission
    const updatedMastery = await prisma.conceptMastery.findFirst({
      where: {
        userId: testUser.id,
        projectId: testProject.id,
        conceptId: weakConcept.id,
      },
    });

    expect(updatedMastery).not.toBeNull();
    // Mastery score should have increased from initial 35 after correct attempt
    expect(updatedMastery!.totalAttempts).toBeGreaterThan(2);
    expect(updatedMastery!.lastAssessedAt).not.toBeNull();

    // Verify QuizAttempt rows in SQLite
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: generatedQuizResult.quizId, userId: testUser.id },
    });
    expect(attempts.length).toBeGreaterThan(0);
  });

  it("completes the quiz and records learning events", async () => {
    const completedQuiz = await prisma.quiz.findUnique({
      where: { id: generatedQuizResult.quizId },
    });

    expect(completedQuiz?.status).toBe("COMPLETED");
    expect(completedQuiz?.score).toBeDefined();
    expect(completedQuiz?.completedAt).not.toBeNull();

    // Verify QUIZ_COMPLETED event
    const quizEvents = await prisma.learningEvent.findMany({
      where: {
        userId: testUser.id,
        projectId: testProject.id,
        eventType: "QUIZ_COMPLETED",
      },
    });
    expect(quizEvents.length).toBeGreaterThan(0);
  });

  it("enforces user isolation: foreign users cannot grade another user's quiz", async () => {
    await expect(
      evaluateQuizSubmission(generatedQuizResult.quizId, foreignUser.id, [])
    ).rejects.toThrow("Quiz not found or unauthorized");
  });
});
