import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { awardPoints } from "@/lib/gamification/pointsService";
// Use require for pdf-parse to avoid ESM/CJS interop quirks
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse");

export interface ProcessedResult {
  totalPages: number;
  totalChunks: number;
  extractedConcepts: string[];
}

/**
 * Parses PDF document, extracts page-delimited text, splits into chunks,
 * detects key concepts, and registers them in the database.
 */
export async function processDocument(
  materialId: string
): Promise<ProcessedResult> {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { project: true },
  });

  if (!material) {
    throw new Error(`Material with ID ${materialId} not found`);
  }

  // Update status to PROCESSING
  await prisma.material.update({
    where: { id: materialId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  // Idempotency: Delete any existing chunks if this is a retry
  await prisma.documentChunk.deleteMany({
    where: { materialId },
  });

  const safeFilename = path.basename(material.fileUrl);
  const diskPath = path.join(process.cwd(), "public", "uploads", safeFilename);

  if (!fs.existsSync(diskPath)) {
    throw new Error(`Document file not found at path: ${diskPath}`);
  }

  const dataBuffer = fs.readFileSync(diskPath);

  // Extract page-delimited text using pdf-parse custom pagerender
  let pageTexts: { page: number; text: string }[] = [];
  let totalPages = 1;
  let fullExtractedText = "";

  try {
    const pdfData = await pdf(dataBuffer, {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        let lastY: number | null = null;
        let pageStr = "";
        for (const item of textContent.items) {
          if (lastY === null || Math.abs(lastY - item.transform[5]) < 2) {
            pageStr += item.str + " ";
          } else {
            pageStr += "\n" + item.str + " ";
          }
          lastY = item.transform[5];
        }
        return `<<<PAGE_${pageData.pageIndex + 1}>>>\n` + pageStr.trim();
      },
    });

    totalPages = pdfData.numpages || 1;
    fullExtractedText = pdfData.text || "";

    // Split text by our page markers
    const rawPages = fullExtractedText.split(/<<<PAGE_(\d+)>>>\n/);
    if (rawPages.length > 1) {
      for (let i = 1; i < rawPages.length; i += 2) {
        const pageNum = parseInt(rawPages[i], 10);
        const text = (rawPages[i + 1] || "").trim();
        if (text.length > 0) {
          pageTexts.push({ page: pageNum, text });
        }
      }
    } else {
      pageTexts = [{ page: 1, text: fullExtractedText.trim() }];
    }
  } catch (parseError: any) {
    console.warn("PDF parser warning, falling back to buffer string decode:", parseError);
    // Graceful fallback for plain text or simple files
    fullExtractedText = dataBuffer.toString("utf-8");
    pageTexts = [{ page: 1, text: fullExtractedText.trim() }];
  }

  // 2. Chunking Strategy: overlapping text blocks (~400-600 characters) per page
  const chunksToInsert: {
    materialId: string;
    projectId: string;
    chunkIndex: number;
    pageNumber: number;
    content: string;
    tokenCount: number;
    concepts?: string;
  }[] = [];

  let globalChunkIndex = 0;
  const discoveredConcepts = new Set<string>();

  for (const { page, text } of pageTexts) {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    for (const para of paragraphs) {
      // Approximate token count: ~4 characters per token
      const tokenCount = Math.max(1, Math.round(para.length / 4));

      // Extract candidate domain concepts from paragraph
      const paraConcepts = extractCandidateConcepts(para);
      paraConcepts.forEach((c) => discoveredConcepts.add(c));

      chunksToInsert.push({
        materialId,
        projectId: material.projectId,
        chunkIndex: globalChunkIndex++,
        pageNumber: page,
        content: para,
        tokenCount,
        concepts: paraConcepts.length > 0 ? JSON.stringify(paraConcepts) : undefined,
      });
    }
  }

  // Fallback if no structured paragraphs found
  if (chunksToInsert.length === 0 && fullExtractedText.trim().length > 0) {
    chunksToInsert.push({
      materialId,
      projectId: material.projectId,
      chunkIndex: 0,
      pageNumber: 1,
      content: fullExtractedText.slice(0, 1500),
      tokenCount: Math.round(Math.min(1500, fullExtractedText.length) / 4),
      concepts: undefined,
    });
  }

  // Bulk insert chunks
  if (chunksToInsert.length > 0) {
    await prisma.documentChunk.createMany({
      data: chunksToInsert,
    });
  }

  // 3. Register Discovered Concepts & Initialize Concept Mastery
  const conceptNames = Array.from(discoveredConcepts).slice(0, 12); // Keep top relevant concepts
  for (const name of conceptNames) {
    // Atomic upsert concept for project
    const concept = await prisma.concept.upsert({
      where: {
        projectId_name: {
          projectId: material.projectId,
          name,
        },
      },
      update: {},
      create: {
        projectId: material.projectId,
        name,
        description: `Key concept extracted from ${material.title}`,
        importanceLevel: "HIGH",
      },
    });

    // Atomic upsert concept mastery
    await prisma.conceptMastery.upsert({
      where: {
        userId_projectId_conceptId: {
          userId: material.project.userId,
          projectId: material.projectId,
          conceptId: concept.id,
        },
      },
      update: {},
      create: {
        userId: material.project.userId,
        projectId: material.projectId,
        conceptId: concept.id,
        masteryScore: 0.0,
        status: "NEEDS_ATTENTION",
        totalAttempts: 0,
        correctAttempts: 0,
      },
    });
  }

  // 4. Update Material status to READY
  await prisma.material.update({
    where: { id: materialId },
    data: {
      status: "READY",
      totalPages: Math.max(1, totalPages),
      extractedText: fullExtractedText.slice(0, 5000), // store preview snippet
      errorMessage: null,
    },
  });

  // 5. Emit Learning Event
  await prisma.learningEvent.create({
    data: {
      userId: material.project.userId,
      projectId: material.projectId,
      eventType: "MATERIAL_PROCESSED",
      payloadJson: JSON.stringify({
        materialId,
        title: material.title,
        chunksCount: chunksToInsert.length,
        totalPages,
        newConceptsCount: conceptNames.length,
      }),
    },
  });

  // 6. Award Points for Material Processing
  try {
    if (material.project?.userId) {
      await awardPoints(material.project.userId, "MATERIAL_PROCESSED", {
        projectId: material.projectId,
        description: `Processed notes: ${material.title}`,
      });
    }
  } catch (err) {
    console.warn("Failed to award points for material processing:", err);
  }

  return {
    totalPages,
    totalChunks: chunksToInsert.length,
    extractedConcepts: conceptNames,
  };
}

/**
 * Heuristic/NLP extractor for technical concepts and terms in text.
 * Looks for defined terms, formulas, and capitalized multi-word phrases.
 */
function extractCandidateConcepts(text: string): string[] {
  const concepts = new Set<string>();

  // Pattern 1: Definitions like "X is defined as ...", "X refers to ..."
  const defPattern = /([A-Z][A-Za-z0-9\s-]{2,30})\s+(?:is defined as|refers to|denotes|is a method for|is an algorithm)/g;
  let match;
  while ((match = defPattern.exec(text)) !== null) {
    const term = match[1].replace(/\s+/g, " ").trim();
    if (term.length > 3 && term.length < 35 && !term.startsWith("This") && !term.startsWith("There")) {
      concepts.add(term);
    }
  }

  // Pattern 2: Multi-word Title Cased technical terms (e.g., "Self-Attention", "Scaled Dot-Product")
  const titlePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  while ((match = titlePattern.exec(text)) !== null) {
    const term = match[1].replace(/\s+/g, " ").trim();
    const commonStops = ["The Following", "For Example", "In Addition", "Figure", "Table", "Section"];
    if (!commonStops.some((s) => term.startsWith(s)) && term.length > 4 && term.length < 35) {
      concepts.add(term);
    }
  }

  return Array.from(concepts).slice(0, 4);
}
