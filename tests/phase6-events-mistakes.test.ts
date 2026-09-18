import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { emitLearningEvent } from "@/lib/events/eventBus";
import { detectAndRemediateRepeatedMistakes } from "@/lib/repeatedMistakeEngine";
import { enqueueJob, executeJobAsync } from "@/lib/queue";

const prisma = new PrismaClient();

describe("Phase 6: Event-Driven Background Workflows & Repeated Mistake Engine", () => {
  let testUser: any;
  let testSpace: any;
  let testProject: any;
  let material: any;
  let conceptAlpha: any;
  let conceptBeta: any;
  let quiz1: any;
  let quiz2: any;
  let quiz3: any;

  beforeAll(async () => {
    // 1. Create isolated test user & workspace
    testUser = await prisma.user.create({
      data: {
        name: "Events & Mistake Learner",
        email: `events_tester_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    testSpace = await prisma.space.create({
      data: {
        userId: testUser.id,
        name: "Neural Networks & Attention",
      },
    });

    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        spaceId: testSpace.id,
        name: "Transformer Self-Attention",
        learningGoal: "Understand QKV matrix projections and gradient scaling",
      },
    });

    // 2. Create Concepts
    conceptAlpha = await prisma.concept.create({
      data: {
        projectId: testProject.id,
        name: "Key-Query Scaling Factor",
        description: "Division by sqrt(d_k) to counteract vanishing softmax gradients",
        importanceLevel: "HIGH",
      },
    });

    conceptBeta = await prisma.concept.create({
      data: {
        projectId: testProject.id,
        name: "Multi-Head Projections",
        description: "Linear projection into subspaces",
        importanceLevel: "MEDIUM",
      },
    });

    // 3. Create Material and Chunk to provide grounding coordinates for remediation
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
          "Key-Query Scaling Factor: We scale the dot product by 1/sqrt(d_k) to prevent extremely small gradients during softmax backprop.",
        concepts: JSON.stringify(["Key-Query Scaling Factor"]),
      },
    });

    // 4. Create Quizzes with simulated question failures
    quiz1 = await prisma.quiz.create({
      data: {
        projectId: testProject.id,
        userId: testUser.id,
        title: "Assessment 1",
        status: "COMPLETED",
        score: 40,
      },
    });

    quiz2 = await prisma.quiz.create({
      data: {
        projectId: testProject.id,
        userId: testUser.id,
        title: "Assessment 2",
        status: "COMPLETED",
        score: 50,
      },
    });

    quiz3 = await prisma.quiz.create({
      data: {
        projectId: testProject.id,
        userId: testUser.id,
        title: "Assessment 3",
        status: "COMPLETED",
        score: 30,
      },
    });

    // Create questions and failed attempts
    // Attempt 1: Failed conceptAlpha on Quiz 1
    const q1 = await prisma.quizQuestion.create({
      data: {
        quizId: quiz1.id,
        conceptId: conceptAlpha.id,
        questionType: "MCQ",
        prompt: "Why is the dot product divided by sqrt(d_k)?",
        correctOptionIndex: 0,
      },
    });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz1.id,
        questionId: q1.id,
        userId: testUser.id,
        selectedOptionIndex: 2, // wrong
        isCorrect: false,
        score: 0,
      },
    });

    // Attempt 2: Failed conceptAlpha AGAIN on Quiz 2 (triggers REPEATED_MISTAKE)
    const q2 = await prisma.quizQuestion.create({
      data: {
        quizId: quiz2.id,
        conceptId: conceptAlpha.id,
        questionType: "OPEN_ENDED",
        prompt: "Explain the purpose of the scaling factor in self-attention.",
      },
    });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz2.id,
        questionId: q2.id,
        userId: testUser.id,
        textResponse: "It makes the model faster.", // wrong
        isCorrect: false,
        score: 20,
      },
    });

    // Attempt 3: Failed conceptAlpha THIRD TIME on Quiz 3 (triggers CRITICAL_CONFUSION)
    const q3 = await prisma.quizQuestion.create({
      data: {
        quizId: quiz3.id,
        conceptId: conceptAlpha.id,
        questionType: "MCQ",
        prompt: "What happens if you omit 1/sqrt(d_k)?",
        correctOptionIndex: 1,
      },
    });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz3.id,
        questionId: q3.id,
        userId: testUser.id,
        selectedOptionIndex: 3, // wrong
        isCorrect: false,
        score: 0,
      },
    });

    // Failed conceptBeta only ONCE on Quiz 1 (should NOT be flagged as repeated mistake)
    const q4 = await prisma.quizQuestion.create({
      data: {
        quizId: quiz1.id,
        conceptId: conceptBeta.id,
        questionType: "MCQ",
        prompt: "How many projection heads are typically used?",
        correctOptionIndex: 0,
      },
    });
    await prisma.quizAttempt.create({
      data: {
        quizId: quiz1.id,
        questionId: q4.id,
        userId: testUser.id,
        selectedOptionIndex: 1, // wrong
        isCorrect: false,
        score: 0,
      },
    });
  });

  afterAll(async () => {
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    await prisma.$disconnect();
  });

  it("emits domain learning events through the event bus and persists to database", async () => {
    const event = await emitLearningEvent({
      eventType: "QUIZ_GENERATED",
      userId: testUser.id,
      projectId: testProject.id,
      payload: { quizId: quiz1.id, questionsCount: 5 },
    });

    expect(event.id).toBeDefined();
    expect(event.eventType).toBe("QUIZ_GENERATED");
    expect(event.userId).toBe(testUser.id);
    expect(event.projectId).toBe(testProject.id);

    // Verify persisted in SQLite
    const savedEvent = await prisma.learningEvent.findUnique({
      where: { id: event.id },
    });
    expect(savedEvent).not.toBeNull();
  });

  it("detects repeated mistake patterns and classifies severity accurately", async () => {
    const scan = await detectAndRemediateRepeatedMistakes(
      testProject.id,
      testUser.id
    );

    expect(scan.detectedPatternsCount).toBe(1); // Only conceptAlpha has >= 2 failures
    const pattern = scan.patterns[0];
    expect(pattern.conceptName).toBe("Key-Query Scaling Factor");
    expect(pattern.failureCount).toBe(3);
    expect(pattern.severity).toBe("CRITICAL_CONFUSION"); // 3 failures = CRITICAL_CONFUSION

    // Verify grounding coordinates embedded
    expect(pattern.remediationMaterialTitle).toBe("Attention Is All You Need Research Paper");
    expect(pattern.remediationPageNumber).toBe(4);
  });

  it("automatically creates a targeted intervention recommendation with citation", async () => {
    const intervention = await prisma.recommendation.findFirst({
      where: {
        projectId: testProject.id,
        userId: testUser.id,
        type: "REPEATED_MISTAKE_REMEDIATION",
      },
    });

    expect(intervention).not.toBeNull();
    expect(intervention?.priority).toBe("HIGH");
    expect(intervention?.title).toContain("Key-Query Scaling Factor");
    expect(intervention?.reason).toContain("Page 4");
    expect(intervention?.reason).toContain("Attention Is All You Need Research Paper");
    expect(intervention?.targetUrl).toBe(`/projects/${testProject.id}?tab=materials`);
  });

  it("enforces idempotency: scanning repeated mistakes does not duplicate recommendations", async () => {
    const initialCount = await prisma.recommendation.count({
      where: {
        projectId: testProject.id,
        userId: testUser.id,
        type: "REPEATED_MISTAKE_REMEDIATION",
      },
    });

    // Run detector a second time
    const repeatScan = await detectAndRemediateRepeatedMistakes(
      testProject.id,
      testUser.id
    );

    expect(repeatScan.interventionsCreatedCount).toBe(0); // None newly created

    const finalCount = await prisma.recommendation.count({
      where: {
        projectId: testProject.id,
        userId: testUser.id,
        type: "REPEATED_MISTAKE_REMEDIATION",
      },
    });

    expect(finalCount).toBe(initialCount);
  });

  it("executes DETECT_REPEATED_MISTAKES background queue worker job to completion", async () => {
    const job = await enqueueJob({
      jobType: "DETECT_REPEATED_MISTAKES",
      payload: { projectId: testProject.id, userId: testUser.id },
    });

    expect(job.id).toBeDefined();

    // Wait for the background execution to complete
    let completedJob = await prisma.backgroundJob.findUnique({
      where: { id: job.id },
    });
    let attempts = 0;
    while (completedJob?.status !== "COMPLETED" && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      completedJob = await prisma.backgroundJob.findUnique({
        where: { id: job.id },
      });
      attempts++;
    }

    expect(completedJob?.status).toBe("COMPLETED");
  });
});
