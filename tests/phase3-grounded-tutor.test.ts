import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { retrieveProjectEvidence } from "@/lib/ai/retrieval";
import { executeTutorTurn } from "@/lib/ai/tutorPrompt";

const prisma = new PrismaClient();

describe("Phase 3: Grounded AI Tutor, Scoped Retrieval & Citation Integrity", () => {
  let testUser: any;
  let testSpace: any;
  let projectA: any;
  let projectB: any;
  let materialA: any;
  let materialB: any;
  let conversationA: any;

  beforeAll(async () => {
    // 1. Create isolated user & space
    testUser = await prisma.user.create({
      data: {
        name: "Grounded Tutor Tester",
        email: `tutor_tester_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    testSpace = await prisma.space.create({
      data: {
        userId: testUser.id,
        name: "Machine Learning Foundations",
      },
    });

    // 2. Create Project A (Transformers)
    projectA = await prisma.project.create({
      data: {
        userId: testUser.id,
        spaceId: testSpace.id,
        name: "Attention Architectures",
        learningGoal: "Master multi-head attention and positional encodings",
      },
    });

    // Create Material A and Chunks for Project A
    materialA = await prisma.material.create({
      data: {
        projectId: projectA.id,
        title: "Attention Is All You Need Research Paper",
        originalFilename: "attention.pdf",
        fileUrl: "/uploads/attention.pdf",
        fileSize: 512000,
        mimeType: "application/pdf",
        status: "READY",
        totalPages: 15,
      },
    });

    await prisma.documentChunk.createMany({
      data: [
        {
          projectId: projectA.id,
          materialId: materialA.id,
          pageNumber: 3,
          chunkIndex: 0,
          content:
            "An attention function can be described as mapping a query and a set of key-value pairs to an output. The output is computed as a weighted sum of the values.",
          concepts: JSON.stringify(["Attention Function", "Query Key Value"]),
        },
        {
          projectId: projectA.id,
          materialId: materialA.id,
          pageNumber: 4,
          chunkIndex: 1,
          content:
            "Scaled Dot-Product Attention computes the attention weights by taking the dot product of query and keys, dividing by sqrt(d_k), and applying a softmax function.",
          concepts: JSON.stringify(["Scaled Dot-Product Attention", "Softmax"]),
        },
      ],
    });

    // 3. Create Project B (Biology / Cell Signaling) for data isolation tests
    projectB = await prisma.project.create({
      data: {
        userId: testUser.id,
        spaceId: testSpace.id,
        name: "Cellular Biology",
        learningGoal: "Understand glycolysis and ATP production",
      },
    });

    materialB = await prisma.material.create({
      data: {
        projectId: projectB.id,
        title: "Cell Biology Handbook",
        originalFilename: "biology.pdf",
        fileUrl: "/uploads/biology.pdf",
        fileSize: 420000,
        mimeType: "application/pdf",
        status: "READY",
        totalPages: 30,
      },
    });

    await prisma.documentChunk.create({
      data: {
        projectId: projectB.id,
        materialId: materialB.id,
        pageNumber: 12,
        chunkIndex: 0,
        content:
          "Glycolysis converts glucose into pyruvate, yielding a net production of two ATP molecules and two NADH molecules per glucose molecule.",
        concepts: JSON.stringify(["Glycolysis", "ATP"]),
      },
    });

    // 4. Create an active conversation in Project A
    conversationA = await prisma.conversation.create({
      data: {
        projectId: projectA.id,
        userId: testUser.id,
        title: "Attention Mechanisms Exploration",
      },
    });
  });

  afterAll(async () => {
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    await prisma.$disconnect();
  });

  it("retrieves project evidence accurately for grounded domain queries", async () => {
    const retrieval = await retrieveProjectEvidence(
      projectA.id,
      "How does scaled dot-product attention work?"
    );

    expect(retrieval.hasSufficientEvidence).toBe(true);
    expect(retrieval.evidence.length).toBeGreaterThan(0);
    expect(retrieval.evidence[0].materialTitle).toBe("Attention Is All You Need Research Paper");
    expect(retrieval.evidence[0].pageNumber).toBe(4);
    expect(retrieval.evidence[0].content).toContain("Scaled Dot-Product Attention");
  });

  it("strictly gates ungrounded queries when project evidence is insufficient", async () => {
    const retrieval = await retrieveProjectEvidence(
      projectA.id,
      "What is the capital of Australia and what is the population?"
    );

    expect(retrieval.hasSufficientEvidence).toBe(false);
    expect(retrieval.evidence.length).toBe(0);
    expect(retrieval.topScore).toBeLessThan(0.75);
  });

  it("enforces cross-project data isolation during retrieval", async () => {
    // Querying for glycolysis in Project A should return 0 evidence even though Project B has it
    const retrievalInA = await retrieveProjectEvidence(
      projectA.id,
      "What are the net products of glycolysis and ATP?"
    );

    expect(retrievalInA.hasSufficientEvidence).toBe(false);
    expect(retrievalInA.evidence.length).toBe(0);

    // Querying for glycolysis in Project B should succeed
    const retrievalInB = await retrieveProjectEvidence(
      projectB.id,
      "What are the net products of glycolysis and ATP?"
    );

    expect(retrievalInB.hasSufficientEvidence).toBe(true);
    expect(retrievalInB.evidence[0].materialTitle).toBe("Cell Biology Handbook");
    expect(retrievalInB.evidence[0].pageNumber).toBe(12);
  });

  it("executes a grounded tutor turn with citations and saves messages to DB", async () => {
    const result = await executeTutorTurn(
      projectA.id,
      testUser.id,
      conversationA.id,
      "Explain scaled dot-product attention in detail."
    );

    expect(result.isUngrounded).toBe(false);
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(20);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0].title).toBe("Attention Is All You Need Research Paper");
    expect(result.citations[0].pageNumber).toBe(4);

    // Verify messages persisted in DB
    const messages = await prisma.message.findMany({
      where: { conversationId: conversationA.id },
      orderBy: { createdAt: "asc" },
    });

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Explain scaled dot-product attention in detail.");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].isUngrounded).toBe(false);
    expect(messages[1].citationsJson).toContain("Attention Is All You Need Research Paper");
  });

  it("executes an ungrounded tutor turn with refusal and flags isUngrounded: true", async () => {
    const result = await executeTutorTurn(
      projectA.id,
      testUser.id,
      conversationA.id,
      "How do I make chocolate chip cookies from scratch?"
    );

    expect(result.isUngrounded).toBe(true);
    expect(result.citations.length).toBe(0);
    expect(result.content).toContain("insufficient evidence");

    // Verify persisted message has isUngrounded flag
    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: conversationA.id },
      orderBy: { createdAt: "desc" },
    });

    expect(lastMessage?.isUngrounded).toBe(true);
    expect(lastMessage?.citationsJson).toBeNull();
  });

  it("logs AI telemetry to AiLog and emits learning event", async () => {
    // Verify AiLog entry exists
    const aiLogs = await prisma.aiLog.findMany({
      where: { userId: testUser.id, feature: "TUTOR" },
    });
    expect(aiLogs.length).toBeGreaterThan(0);
    expect(aiLogs[0].status).toBe("SUCCESS");

    // Verify LearningEvent logged
    const learningEvents = await prisma.learningEvent.findMany({
      where: { userId: testUser.id, eventType: "TUTOR_INTERACTED" },
    });
    expect(learningEvents.length).toBeGreaterThan(0);
  });
});
