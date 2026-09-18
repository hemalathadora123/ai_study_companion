import { prisma } from "@/lib/db";

export interface RetrievedEvidence {
  chunkId: string;
  materialId: string;
  materialTitle: string;
  pageNumber: number;
  content: string;
  score: number;
}

export interface RetrievalResult {
  hasSufficientEvidence: boolean;
  evidence: RetrievedEvidence[];
  query: string;
  topScore: number;
}

/**
 * Scoped Project Retrieval Engine.
 * Fetches chunks strictly from the active project and performs hybrid relevance scoring.
 */
export async function retrieveProjectEvidence(
  projectId: string,
  query: string,
  limit: number = 3
): Promise<RetrievalResult> {
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  if (queryTerms.length === 0) {
    return {
      hasSufficientEvidence: false,
      evidence: [],
      query,
      topScore: 0,
    };
  }

  // Fetch all chunks for this project with data isolation
  const chunks = await prisma.documentChunk.findMany({
    where: { projectId },
    include: {
      material: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  // Filter to ready materials only
  const readyChunks = chunks.filter((c) => c.material.status === "READY");

  if (readyChunks.length === 0) {
    return {
      hasSufficientEvidence: false,
      evidence: [],
      query,
      topScore: 0,
    };
  }

  // Score each chunk
  const scoredChunks: RetrievedEvidence[] = [];

  for (const chunk of readyChunks) {
    const contentLower = chunk.content.toLowerCase();
    const contentWords = new Set(
      contentLower
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 0)
    );

    let score = 0;
    let matchCount = 0;

    // 1. Exact whole-word matching & frequency
    for (const term of queryTerms) {
      if (contentWords.has(term)) {
        matchCount++;
        const regex = new RegExp(`\\b${term}\\b`, "gi");
        const occurrences = (contentLower.match(regex) || []).length;
        score += Math.min(occurrences * 0.3, 1.2);
      }
    }

    // 2. Keyword coverage ratio
    const termCoverageRatio = matchCount / queryTerms.length;
    score += termCoverageRatio * 2.0;

    // 3. Exact phrase match bonus
    const cleanQuery = query.toLowerCase().trim();
    if (cleanQuery.length > 5 && contentLower.includes(cleanQuery)) {
      score += 3.0;
    }

    // 4. Extracted concept overlap (checks if query mentions this chunk's concepts)
    let conceptMatch = false;
    if (chunk.concepts) {
      try {
        const concepts: string[] = JSON.parse(chunk.concepts);
        for (const concept of concepts) {
          const cLower = concept.toLowerCase();
          if (cleanQuery.includes(cLower) || queryTerms.some((t) => cLower.includes(t))) {
            score += 1.5;
            conceptMatch = true;
          }
        }
      } catch (e) {
        // ignore json parse
      }
    }

    // A chunk with neither matching words nor matching concepts has zero relevance
    if (matchCount === 0 && !conceptMatch) {
      score = 0;
    }

    if (score >= 0.75) {
      scoredChunks.push({
        chunkId: chunk.id,
        materialId: chunk.material.id,
        materialTitle: chunk.material.title,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        score,
      });
    }
  }

  // Sort descending by relevance score
  scoredChunks.sort((a, b) => b.score - a.score);

  const topScore = scoredChunks.length > 0 ? scoredChunks[0].score : 0;
  // Threshold for sufficient evidence: requires at least score >= 1.0
  const hasSufficientEvidence = scoredChunks.length > 0 && topScore >= 1.0;

  return {
    hasSufficientEvidence,
    evidence: scoredChunks.slice(0, limit),
    query,
    topScore,
  };
}

const STOP_WORDS = new Set([
  "what", "when", "where", "which", "who", "whom", "this", "that", "these",
  "those", "am", "is", "are", "was", "were", "be", "been", "being", "have",
  "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the",
  "and", "but", "if", "or", "because", "as", "until", "while", "of", "at",
  "by", "for", "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "to", "from", "up", "down",
  "in", "out", "on", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "can", "will", "just",
  "should", "now", "tell", "explain", "please", "give"
]);
