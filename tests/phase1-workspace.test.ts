import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Phase 1: Foundation, Workspace Hierarchy & Data Isolation", () => {
  let testUserA: any;
  let testUserB: any;
  let spaceA: any;
  let projectA: any;

  beforeAll(async () => {
    // Setup isolated test users
    testUserA = await prisma.user.create({
      data: {
        name: "Test User A",
        email: `test_a_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    testUserB = await prisma.user.create({
      data: {
        name: "Test User B",
        email: `test_b_${Date.now()}@example.com`,
        role: "USER",
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testUserA?.id) {
      await prisma.user.delete({ where: { id: testUserA.id } });
    }
    if (testUserB?.id) {
      await prisma.user.delete({ where: { id: testUserB.id } });
    }
    await prisma.$disconnect();
  });

  it("creates a Space with valid metadata and user ownership", async () => {
    spaceA = await prisma.space.create({
      data: {
        userId: testUserA.id,
        name: "Quantum Computing Basics",
        description: "Qubits, superposition, and quantum gates.",
        color: "purple",
        icon: "Atom",
      },
    });

    expect(spaceA.id).toBeDefined();
    expect(spaceA.userId).toBe(testUserA.id);
    expect(spaceA.name).toBe("Quantum Computing Basics");
  });

  it("creates a Project within a Space with a defined Learning Goal", async () => {
    projectA = await prisma.project.create({
      data: {
        spaceId: spaceA.id,
        userId: testUserA.id,
        name: "Shor's Algorithm & Quantum Phase Estimation",
        learningGoal: "Understand modular exponentiation and QFT in factoring integers",
        status: "ACTIVE",
        progress: 0.0,
      },
    });

    expect(projectA.id).toBeDefined();
    expect(projectA.spaceId).toBe(spaceA.id);
    expect(projectA.learningGoal).toBe("Understand modular exponentiation and QFT in factoring integers");
  });

  it("enforces Project-level Data Isolation between User A and User B", async () => {
    // User B tries to query User A's project
    const userBAttempt = await prisma.project.findFirst({
      where: {
        id: projectA.id,
        userId: testUserB.id, // Scoped to User B
      },
    });

    // Isolation check: User B must NOT receive User A's project
    expect(userBAttempt).toBeNull();

    // User A can access it
    const userAQuery = await prisma.project.findFirst({
      where: {
        id: projectA.id,
        userId: testUserA.id,
      },
    });
    expect(userAQuery).not.toBeNull();
    expect(userAQuery?.id).toBe(projectA.id);
  });

  it("creates concepts and mastery tracking linked to the project", async () => {
    const concept = await prisma.concept.create({
      data: {
        projectId: projectA.id,
        name: "Quantum Superposition",
        description: "Linear combination of state vectors |0> and |1>",
        importanceLevel: "HIGH",
      },
    });

    const mastery = await prisma.conceptMastery.create({
      data: {
        userId: testUserA.id,
        projectId: projectA.id,
        conceptId: concept.id,
        masteryScore: 75.0,
        status: "STABLE",
        totalAttempts: 4,
        correctAttempts: 3,
      },
    });

    expect(mastery.masteryScore).toBe(75.0);
    expect(mastery.status).toBe("STABLE");
  });

  it("cascades deletion cleanly when a Space is deleted", async () => {
    // Delete Space A
    await prisma.space.delete({
      where: { id: spaceA.id },
    });

    // Verify Project A was cascade deleted
    const checkProject = await prisma.project.findUnique({
      where: { id: projectA.id },
    });
    expect(checkProject).toBeNull();
  });
});
