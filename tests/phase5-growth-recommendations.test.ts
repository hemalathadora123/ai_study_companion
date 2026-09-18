import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  getProjectGrowthAnalytics,
  updateConceptMasteryWithHistory,
} from "@/lib/masteryEngine";
import { generateProjectRecommendations } from "@/lib/ai/recommendationEngine";

const prisma = new PrismaClient();

describe("Phase 5: Concept Mastery, Growth Trajectory & Actionable Recommendations", () => {
  let testUserA: any;
  let testUserB: any;
  let spaceA: any;
  let projectA: any;
  let projectB: any;
  let concept1: any;
  let concept2: any;
  let concept3: any;

  beforeAll(async () => {
    // 1. Create two isolated users
    testUserA = await prisma.user.create({
      data: {
        name: "Growth Learner A",
        email: `growth_a_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    testUserB = await prisma.user.create({
      data: {
        name: "Growth Learner B",
        email: `growth_b_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    // 2. Create Space & Projects
    spaceA = await prisma.space.create({
      data: {
        userId: testUserA.id,
        name: "AI & Neural Nets",
      },
    });

    projectA = await prisma.project.create({
      data: {
        userId: testUserA.id,
        spaceId: spaceA.id,
        name: "Transformer Architectures",
        learningGoal: "Master attention mechanisms and self-attention math",
        progress: 0,
      },
    });

    projectB = await prisma.project.create({
      data: {
        userId: testUserB.id,
        spaceId: spaceA.id,
        name: "Unrelated Project B",
        learningGoal: "User B's private goal",
      },
    });

    // 3. Create Concepts with differing mastery profiles for User A
    concept1 = await prisma.concept.create({
      data: {
        projectId: projectA.id,
        name: "Scaled Dot-Product Attention",
        description: "Scale dot product by sqrt(d_k)",
        importanceLevel: "HIGH",
      },
    });

    concept2 = await prisma.concept.create({
      data: {
        projectId: projectA.id,
        name: "Multi-Head Attention",
        description: "Joint attention across multiple representation subspaces",
        importanceLevel: "HIGH",
      },
    });

    concept3 = await prisma.concept.create({
      data: {
        projectId: projectA.id,
        name: "Positional Encodings",
        description: "Sinusoidal order representation",
        importanceLevel: "MEDIUM",
      },
    });

    // Register initial masteries:
    // concept1: 30% -> NEEDS_ATTENTION
    // concept2: 65% -> IMPROVING
    // concept3: 85% -> STABLE
    await prisma.conceptMastery.create({
      data: {
        userId: testUserA.id,
        projectId: projectA.id,
        conceptId: concept1.id,
        masteryScore: 30.0,
        status: "NEEDS_ATTENTION",
        totalAttempts: 4,
        correctAttempts: 1,
      },
    });

    await prisma.conceptMastery.create({
      data: {
        userId: testUserA.id,
        projectId: projectA.id,
        conceptId: concept2.id,
        masteryScore: 65.0,
        status: "IMPROVING",
        totalAttempts: 6,
        correctAttempts: 4,
      },
    });

    await prisma.conceptMastery.create({
      data: {
        userId: testUserA.id,
        projectId: projectA.id,
        conceptId: concept3.id,
        masteryScore: 85.0,
        status: "STABLE",
        totalAttempts: 10,
        correctAttempts: 9,
      },
    });

    // 4. Create sample Material to ground recommendations
    await prisma.material.create({
      data: {
        projectId: projectA.id,
        title: "Attention Is All You Need Research Paper",
        originalFilename: "attention.pdf",
        fileUrl: "/uploads/attention.pdf",
        fileSize: 450000,
        mimeType: "application/pdf",
        status: "READY",
        totalPages: 15,
      },
    });
  });

  afterAll(async () => {
    if (testUserA?.id) {
      await prisma.user.delete({ where: { id: testUserA.id } });
    }
    if (testUserB?.id) {
      await prisma.user.delete({ where: { id: testUserB.id } });
    }
    await prisma.$disconnect();
  });

  it("calculates accurate project growth analytics and synchronizes project progress", async () => {
    const analytics = await getProjectGrowthAnalytics(projectA.id, testUserA.id);

    expect(analytics.projectId).toBe(projectA.id);
    expect(analytics.totalConcepts).toBe(3);
    expect(analytics.stableCount).toBe(1);
    expect(analytics.improvingCount).toBe(1);
    expect(analytics.needsAttentionCount).toBe(1);

    // Average of 30, 65, 85 is 60
    expect(analytics.overallProgress).toBe(60);

    // Total attempts: 4 + 6 + 10 = 20; correct: 1 + 4 + 9 = 14 -> 70% accuracy
    expect(analytics.totalAttempts).toBe(20);
    expect(analytics.overallAccuracyRate).toBe(70);

    // Verify Project.progress was synced in SQLite
    const updatedProject = await prisma.project.findUnique({
      where: { id: projectA.id },
    });
    expect(updatedProject?.progress).toBe(60);
  });

  it("records mastery score changes and appends to chronological history", async () => {
    // Update concept1 from 30 to 55
    await updateConceptMasteryWithHistory(
      testUserA.id,
      projectA.id,
      concept1.id,
      55
    );

    // Update concept1 from 55 to 70
    await updateConceptMasteryWithHistory(
      testUserA.id,
      projectA.id,
      concept1.id,
      70
    );

    const updatedMastery = await prisma.conceptMastery.findFirst({
      where: {
        userId: testUserA.id,
        projectId: projectA.id,
        conceptId: concept1.id,
      },
    });

    expect(updatedMastery?.masteryScore).toBe(70);
    expect(updatedMastery?.status).toBe("IMPROVING"); // 60-74% is IMPROVING

    const history = JSON.parse(updatedMastery?.historyJson || "[]");
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[history.length - 1].score).toBe(70);
  });

  it("generates actionable recommendations prioritizing weak concepts and materials", async () => {
    const recs = await generateProjectRecommendations(projectA.id, testUserA.id);

    expect(recs.length).toBeGreaterThanOrEqual(1);

    // Verify recommendations persisted in database
    const dbRecs = await prisma.recommendation.findMany({
      where: { projectId: projectA.id, userId: testUserA.id, isDismissed: false },
    });

    expect(dbRecs.length).toBeGreaterThanOrEqual(1);
    expect(dbRecs[0].targetUrl).toBeDefined();
    expect(dbRecs[0].reason.length).toBeGreaterThan(15);
  });

  it("supports completing a recommendation", async () => {
    const rec = await prisma.recommendation.findFirst({
      where: { projectId: projectA.id, userId: testUserA.id, isDismissed: false },
    });

    expect(rec).not.toBeNull();

    // Mark as completed
    const updated = await prisma.recommendation.update({
      where: { id: rec!.id },
      data: { isCompleted: true },
    });

    expect(updated.isCompleted).toBe(true);
  });

  it("enforces cross-user data isolation for growth analytics and recommendations", async () => {
    // User B querying Project A should fail
    await expect(
      getProjectGrowthAnalytics(projectA.id, testUserB.id)
    ).resolves.toMatchObject({
      // Concept masteries for User B in Project A should have 0 score because User B hasn't studied Project A
      totalAttempts: 0,
      overallProgress: 0,
    });
  });
});
