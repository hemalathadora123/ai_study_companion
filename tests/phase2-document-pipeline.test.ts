import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { processDocument } from "@/lib/documentProcessor";
import { enqueueJob, executeJobAsync } from "@/lib/queue";

const prisma = new PrismaClient();

describe("Phase 2: Learning Materials & Asynchronous Document Processing Pipeline", () => {
  let testUser: any;
  let testSpace: any;
  let testProject: any;
  let testPdfPath: string;
  let testMaterial: any;

  beforeAll(async () => {
    // 1. Setup isolated test environment
    testUser = await prisma.user.create({
      data: {
        name: "Doc Pipeline Learner",
        email: `doc_tester_${Date.now()}@example.com`,
        role: "USER",
      },
    });

    testSpace = await prisma.space.create({
      data: {
        userId: testUser.id,
        name: "NLP & Foundations",
      },
    });

    testProject = await prisma.project.create({
      data: {
        userId: testUser.id,
        spaceId: testSpace.id,
        name: "Self-Attention Architectures",
        learningGoal: "Understand attention matrix computation",
      },
    });

    // 2. Generate a valid minimal PDF on disk
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    testPdfPath = path.join(uploadsDir, `test_doc_${Date.now()}.pdf`);
    const validPdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 72 >> stream
BT /F1 12 Tf 100 700 Td (Self-Attention Mechanism is defined as dot-product mapping.) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000234 00000 n 
0000000357 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
442
%%EOF`;

    fs.writeFileSync(testPdfPath, validPdfContent);
  });

  afterAll(async () => {
    // Cleanup files and database
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }
    if (testUser?.id) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    await prisma.$disconnect();
  });

  it("creates a Material record in QUEUED status upon upload", async () => {
    testMaterial = await prisma.material.create({
      data: {
        projectId: testProject.id,
        title: "Test Attention Notes",
        originalFilename: "test_doc.pdf",
        fileUrl: `/uploads/${path.basename(testPdfPath)}`,
        fileSize: 500,
        mimeType: "application/pdf",
        status: "QUEUED",
      },
    });

    expect(testMaterial.id).toBeDefined();
    expect(testMaterial.status).toBe("QUEUED");
  });

  it("enqueues and executes background processing job", async () => {
    const job = await enqueueJob({
      jobType: "PROCESS_DOCUMENT",
      payload: { materialId: testMaterial.id, projectId: testProject.id },
    });

    expect(job.id).toBeDefined();
    expect(job.jobType).toBe("PROCESS_DOCUMENT");

    // Wait for background job to reach COMPLETED
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
    expect(completedJob?.processedAt).not.toBeNull();
  });

  it("transitions Material status to READY and extracts page-referenced chunks", async () => {
    const updatedMaterial = await prisma.material.findUnique({
      where: { id: testMaterial.id },
      include: { chunks: true },
    });

    expect(updatedMaterial?.status).toBe("READY");
    expect(updatedMaterial?.totalPages).toBeGreaterThanOrEqual(1);
    expect(updatedMaterial?.chunks.length).toBeGreaterThan(0);

    const chunk = updatedMaterial?.chunks[0];
    expect(chunk?.pageNumber).toBe(1);
    expect(chunk?.content).toContain("Self-Attention");
    expect(chunk?.tokenCount).toBeGreaterThan(0);
  });

  it("automatically discovers concepts and registers initial ConceptMastery", async () => {
    const concepts = await prisma.concept.findMany({
      where: { projectId: testProject.id },
    });

    expect(concepts.length).toBeGreaterThan(0);
    const concept = concepts[0];

    const mastery = await prisma.conceptMastery.findFirst({
      where: {
        userId: testUser.id,
        projectId: testProject.id,
        conceptId: concept.id,
      },
    });

    expect(mastery).not.toBeNull();
    expect(mastery?.status).toBe("NEEDS_ATTENTION");
    expect(mastery?.masteryScore).toBe(0.0);
  });

  it("enforces idempotency: retrying document processing does not create duplicate chunks", async () => {
    const initialChunks = await prisma.documentChunk.count({
      where: { materialId: testMaterial.id },
    });

    // Run processDocument again (simulating retry or re-process)
    await processDocument(testMaterial.id);

    const reprocessedChunks = await prisma.documentChunk.count({
      where: { materialId: testMaterial.id },
    });

    // Idempotency: chunk count must be identical, not doubled
    expect(reprocessedChunks).toBe(initialChunks);
  });

  it("gracefully handles invalid/missing files with FAILED status and error tracking", async () => {
    const badMaterial = await prisma.material.create({
      data: {
        projectId: testProject.id,
        title: "Non Existent File",
        originalFilename: "missing.pdf",
        fileUrl: "/uploads/does_not_exist_404.pdf",
        fileSize: 100,
        status: "QUEUED",
      },
    });

    const failedJob = await prisma.backgroundJob.create({
      data: {
        jobType: "PROCESS_DOCUMENT",
        payloadJson: JSON.stringify({ materialId: badMaterial.id }),
        status: "PENDING",
        maxRetries: 1,
      },
    });

    // Execute job, which should catch the missing file error
    await executeJobAsync(failedJob.id);

    const checkJob = await prisma.backgroundJob.findUnique({
      where: { id: failedJob.id },
    });
    expect(checkJob?.status).toBe("FAILED");
    expect(checkJob?.error).toContain("not found");

    const checkMaterial = await prisma.material.findUnique({
      where: { id: badMaterial.id },
    });
    expect(checkMaterial?.status).toBe("FAILED");
    expect(checkMaterial?.errorMessage).toContain("not found");
  });
});
