import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getObservabilityMetrics } from "@/lib/observability";
import { runAiEvaluationSuite } from "@/lib/ai/evaluationSuite";
import { GET as getObservabilityApi } from "@/app/api/admin/observability/route";
import { GET as getEvaluationApi, POST as postEvaluationApi } from "@/app/api/admin/evaluation/route";

const prisma = new PrismaClient();

describe("Phase 7: Observability, Admin Dashboard & AI Evaluation Suite", () => {
  let testUser: any;
  let testSpace: any;
  let testProject: any;
  let testMaterial: any;

  beforeAll(async () => {
    // 1. Create isolated test user & project
    testUser = await prisma.user.create({
      data: {
        name: "Telemetry & Eval Admin",
        email: `admin_tester_${Date.now()}@example.com`,
        role: "ADMIN",
      },
    });

    testSpace = await prisma.space.create({
      data: {
        userId: testUser.id,
        name: "Observability Space",
      },
    });

    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        spaceId: testSpace.id,
        name: "AI Observability Benchmark Project",
        learningGoal: "Validate groundedness, retrieval precision, and grading consistency",
      },
    });

    testMaterial = await prisma.material.create({
      data: {
        projectId: testProject.id,
        title: "Self-Attention Mechanism Fundamentals",
        originalFilename: "self_attention.pdf",
        fileUrl: "/uploads/self_attention.pdf",
        mimeType: "application/pdf",
        fileSize: 1024 * 50,
        status: "READY",
      },
    });

    // Create document chunks for retrieval & grounded tutor testing
    await prisma.documentChunk.create({
      data: {
        projectId: testProject.id,
        materialId: testMaterial.id,
        chunkIndex: 0,
        pageNumber: 1,
        content:
          "Attention weights compute the dot-product mapping between query and key vectors, scaled by sqrt(d_k) to avoid vanishing gradients.",
        tokenCount: 26,
      },
    });

    await prisma.documentChunk.create({
      data: {
        projectId: testProject.id,
        materialId: testMaterial.id,
        chunkIndex: 1,
        pageNumber: 2,
        content:
          "The output of the attention function is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.",
        tokenCount: 38,
      },
    });

    // Create sample AI logs across various features
    await prisma.aiLog.createMany({
      data: [
        {
          userId: testUser.id,
          feature: "TUTOR",
          model: "gemini-2.5-flash",
          promptTokens: 250,
          completionTokens: 100,
          totalTokens: 350,
          latencyMs: 320,
          costEstimate: 0.00018,
          status: "SUCCESS",
          metadataJson: JSON.stringify({ query: "Explain attention", citations: 1 }),
        },
        {
          userId: testUser.id,
          feature: "TUTOR",
          model: "gemini-2.5-flash",
          promptTokens: 150,
          completionTokens: 80,
          totalTokens: 230,
          latencyMs: 240,
          costEstimate: 0.00012,
          status: "SUCCESS",
          metadataJson: JSON.stringify({ query: "What is softmax?" }),
        },
        {
          userId: testUser.id,
          feature: "QUIZ_GENERATION",
          model: "gemini-2.5-flash",
          promptTokens: 400,
          completionTokens: 300,
          totalTokens: 700,
          latencyMs: 750,
          costEstimate: 0.00042,
          status: "SUCCESS",
          metadataJson: JSON.stringify({ count: 3, difficulty: "MEDIUM" }),
        },
        {
          userId: testUser.id,
          feature: "ASSESSMENT_EVALUATION",
          model: "gemini-2.5-flash",
          promptTokens: 300,
          completionTokens: 150,
          totalTokens: 450,
          latencyMs: 410,
          costEstimate: 0.00025,
          status: "SUCCESS",
          metadataJson: JSON.stringify({ rubricScore: 85 }),
        },
        {
          userId: testUser.id,
          feature: "TUTOR",
          model: "gemini-2.5-flash",
          promptTokens: 100,
          completionTokens: 0,
          totalTokens: 100,
          latencyMs: 120,
          costEstimate: 0.00005,
          status: "ERROR",
          errorMessage: "Rate limit simulated test",
          metadataJson: JSON.stringify({ error: true }),
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.aiLog.deleteMany({ where: { userId: testUser.id } });
    await prisma.documentChunk.deleteMany({ where: { projectId: testProject.id } });
    await prisma.material.deleteMany({ where: { projectId: testProject.id } });
    await prisma.conversation.deleteMany({ where: { projectId: testProject.id } });
    await prisma.project.deleteMany({ where: { id: testProject.id } });
    await prisma.space.deleteMany({ where: { id: testSpace.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. OBSERVABILITY TELEMETRY AGGREGATION
  // ─────────────────────────────────────────────────────────────
  it("should aggregate overall AI metrics (calls, success rate, tokens, cost, latency, p95)", async () => {
    const metrics = await getObservabilityMetrics({ userId: testUser.id });

    expect(metrics.totalCalls).toBe(5);
    expect(metrics.successCount).toBe(4);
    expect(metrics.errorCount).toBe(1);
    expect(metrics.successRate).toBe(80); // 4 / 5 = 80%

    // Token check
    expect(metrics.totalTokens).toBe(350 + 230 + 700 + 450 + 100); // 1830
    expect(metrics.promptTokens).toBe(250 + 150 + 400 + 300 + 100); // 1200
    expect(metrics.completionTokens).toBe(100 + 80 + 300 + 150 + 0); // 630

    // Cost estimate
    expect(metrics.totalCostEstimate).toBeGreaterThan(0.0005);

    // Latencies: [120, 240, 320, 410, 750] -> avg = 368
    expect(metrics.averageLatencyMs).toBe(368);
    // p95 latency should be near top value (750)
    expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(410);

    // Recent logs
    expect(metrics.recentLogs.length).toBe(5);
    const errorLog = metrics.recentLogs.find((l) => l.status === "ERROR");
    expect(errorLog).toBeDefined();
    expect(errorLog?.errorMessage).toBe("Rate limit simulated test");
  });

  // ─────────────────────────────────────────────────────────────
  // 2. FEATURE-LEVEL BREAKDOWN
  // ─────────────────────────────────────────────────────────────
  it("should generate per-feature breakdown metrics accurately", async () => {
    const metrics = await getObservabilityMetrics({ userId: testUser.id });
    const { featureBreakdown } = metrics;

    expect(featureBreakdown.length).toBe(3); // TUTOR, QUIZ_GENERATION, ASSESSMENT_EVALUATION

    const tutorStats = featureBreakdown.find((f) => f.feature === "TUTOR");
    expect(tutorStats).toBeDefined();
    expect(tutorStats?.count).toBe(3);
    expect(tutorStats?.tokens).toBe(680); // 350 + 230 + 100

    const quizGenStats = featureBreakdown.find((f) => f.feature === "QUIZ_GENERATION");
    expect(quizGenStats).toBeDefined();
    expect(quizGenStats?.count).toBe(1);
    expect(quizGenStats?.tokens).toBe(700);

    const evalStats = featureBreakdown.find((f) => f.feature === "ASSESSMENT_EVALUATION");
    expect(evalStats).toBeDefined();
    expect(evalStats?.count).toBe(1);
    expect(evalStats?.tokens).toBe(450);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. FEATURE FILTERING
  // ─────────────────────────────────────────────────────────────
  it("should correctly filter logs by feature when requested", async () => {
    const tutorMetrics = await getObservabilityMetrics({
      userId: testUser.id,
      feature: "TUTOR",
    });

    expect(tutorMetrics.totalCalls).toBe(3);
    expect(tutorMetrics.recentLogs.every((l) => l.feature === "TUTOR")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. AUTOMATED AI EVALUATION BENCHMARK SUITE
  // ─────────────────────────────────────────────────────────────
  it("should run the complete AI evaluation benchmark suite and produce 3-pillar scorecards", async () => {
    const report = await runAiEvaluationSuite(testProject.id, testUser.id);

    expect(report).toBeDefined();
    expect(report.totalCases).toBe(6);
    expect(report.passedCount).toBeGreaterThanOrEqual(4);

    // Verify 3 Core Pillar Scores
    expect(report.groundednessScore).toBeGreaterThanOrEqual(50);
    expect(report.retrievalPrecisionScore).toBeGreaterThanOrEqual(50);
    expect(report.gradingConsistencyScore).toBeGreaterThanOrEqual(50);
    expect(report.overallScore).toBeGreaterThanOrEqual(50);

    // Verify benchmark cases cover each category
    const categories = report.benchmarkCases.map((c) => c.category);
    expect(categories).toContain("RETRIEVAL");
    expect(categories).toContain("GROUNDEDNESS");
    expect(categories).toContain("GRADING");

    // Verify Anti-Hallucination Rejection case
    const antiHallucination = report.benchmarkCases.find(
      (c) => c.name === "Anti-Hallucination Rejection"
    );
    expect(antiHallucination).toBeDefined();
    expect(antiHallucination?.passed).toBe(true);

    // Verify Ungrounded Query Gate case
    const ungroundedGate = report.benchmarkCases.find(
      (c) => c.name === "Ungrounded Query Gate"
    );
    expect(ungroundedGate).toBeDefined();
    expect(ungroundedGate?.passed).toBe(true);

    // Verify benchmark run was logged into AiLog
    const evalLog = await prisma.aiLog.findFirst({
      where: {
        userId: testUser.id,
        feature: "EVALUATION_BENCHMARK",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(evalLog).toBeDefined();
    expect(evalLog?.status).toBe("SUCCESS");
    const meta = JSON.parse(evalLog?.metadataJson || "{}");
    expect(meta.overallScore).toBe(report.overallScore);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. ADMIN API ENDPOINTS (OBSERVABILITY & EVALUATION)
  // ─────────────────────────────────────────────────────────────
  it("should handle GET /api/admin/observability and return aggregated telemetry", async () => {
    const req = new Request("http://localhost:3000/api/admin/observability?limit=50", {
      headers: { "x-user-id": testUser.id },
    });

    const res = await getObservabilityApi(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.metrics).toBeDefined();
    expect(data.metrics.totalCalls).toBeGreaterThanOrEqual(5);
  });

  it("should handle POST and GET /api/admin/evaluation for benchmark execution and retrieval", async () => {
    // 1. POST benchmark execution
    const postReq = new Request("http://localhost:3000/api/admin/evaluation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": testUser.id,
      },
      body: JSON.stringify({ projectId: testProject.id }),
    });

    const postRes = await postEvaluationApi(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.report).toBeDefined();
    expect(postData.report.benchmarkCases.length).toBe(6);

    // 2. GET latest benchmark report
    const getReq = new Request("http://localhost:3000/api/admin/evaluation", {
      headers: { "x-user-id": testUser.id },
    });
    const getRes = await getEvaluationApi(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.lastReport).toBeDefined();
    expect(getData.lastReport.overallScore).toBe(postData.report.overallScore);
    expect(getData.lastRunAt).toBeDefined();
  });
});
