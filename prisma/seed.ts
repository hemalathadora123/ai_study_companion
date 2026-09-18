import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AI Study Companion database...");

  // Clear existing data in reverse order of dependencies
  await prisma.aiLog.deleteMany();
  await prisma.backgroundJob.deleteMany();
  await prisma.learningEvent.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.conceptMastery.deleteMany();
  await prisma.concept.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.material.deleteMany();
  await prisma.project.deleteMany();
  await prisma.space.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Default Learner and Admin User
  const learner = await prisma.user.create({
    data: {
      name: "Alex Dev",
      email: "alex@example.com",
      password: hashPassword("password123"),
      role: "USER",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Alex",
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "admin@studycompanion.io",
      password: hashPassword("admin123"),
      role: "ADMIN",
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Admin",
    },
  });

  // 2. Create Learning Spaces
  const spaceAI = await prisma.space.create({
    data: {
      userId: learner.id,
      name: "Machine Learning & AI Engineering",
      description: "Mastering deep learning architectures, attention math, diffusion, and LLM systems.",
      icon: "Brain",
      color: "indigo",
    },
  });

  const spaceSys = await prisma.space.create({
    data: {
      userId: learner.id,
      name: "Distributed Systems & Cloud",
      description: "Consensus algorithms, replication protocols, fault tolerance, and event-driven architectures.",
      icon: "Server",
      color: "emerald",
    },
  });

  // 3. Create Projects in Space 1
  const projectTransformers = await prisma.project.create({
    data: {
      spaceId: spaceAI.id,
      userId: learner.id,
      name: "Transformers & Attention Mechanisms",
      description: "Deep dive into Vaswani et al. 'Attention Is All You Need' and self-attention computational flow.",
      learningGoal: "Understand self-attention query-key-value math, multi-head projections, and causal masking.",
      status: "ACTIVE",
      progress: 68.0,
    },
  });

  const projectDiffusion = await prisma.project.create({
    data: {
      spaceId: spaceAI.id,
      userId: learner.id,
      name: "Diffusion Models & Score Matching",
      description: "Mathematical formulation of forward noise addition and reverse denoising with UNet.",
      learningGoal: "Grasp DDPM formulations, variance schedules, and noise prediction loss functions.",
      status: "ACTIVE",
      progress: 38.0,
    },
  });

  // Projects in Space 2
  const projectRaft = await prisma.project.create({
    data: {
      spaceId: spaceSys.id,
      userId: learner.id,
      name: "Raft Consensus Protocol",
      description: "Understand leader election, heartbeat intervals, log replication, and safety invariants.",
      learningGoal: "Understand how Raft guarantees linearizable state machine replication under network partitions.",
      status: "ACTIVE",
      progress: 82.0,
    },
  });

  // 4. Create Concepts for Project 1 (matching PRD Section 10 page 10 example)
  const conceptA = await prisma.concept.create({
    data: {
      projectId: projectTransformers.id,
      name: "Self-Attention Mechanism",
      description: "Dot-product alignment between query and key vectors scaled by sqrt(d_k).",
      importanceLevel: "HIGH",
    },
  });

  const conceptB = await prisma.concept.create({
    data: {
      projectId: projectTransformers.id,
      name: "Multi-Head Attention",
      description: "Linear projections into multiple subspace representations before parallel attention.",
      importanceLevel: "HIGH",
    },
  });

  const conceptC = await prisma.concept.create({
    data: {
      projectId: projectTransformers.id,
      name: "Positional Encodings",
      description: "Sinusoidal or learned position embeddings to inject sequence order awareness.",
      importanceLevel: "HIGH",
    },
  });

  const conceptD = await prisma.concept.create({
    data: {
      projectId: projectTransformers.id,
      name: "Feed-Forward Sublayers & Residuals",
      description: "Position-wise dense transformations with LayerNorm and residual connections.",
      importanceLevel: "MEDIUM",
    },
  });

  // 5. Create Concept Mastery Records (Values mirroring PRD Page 10: 88%, 72%, 51%, 42%)
  await prisma.conceptMastery.createMany({
    data: [
      {
        userId: learner.id,
        projectId: projectTransformers.id,
        conceptId: conceptA.id,
        masteryScore: 88.0,
        status: "IMPROVING",
        totalAttempts: 12,
        correctAttempts: 11,
        lastAssessedAt: new Date(),
        historyJson: JSON.stringify([
          { date: "2026-09-10", score: 65 },
          { date: "2026-09-13", score: 78 },
          { date: "2026-09-16", score: 88 },
        ]),
      },
      {
        userId: learner.id,
        projectId: projectTransformers.id,
        conceptId: conceptB.id,
        masteryScore: 72.0,
        status: "STABLE",
        totalAttempts: 9,
        correctAttempts: 7,
        lastAssessedAt: new Date(),
        historyJson: JSON.stringify([
          { date: "2026-09-11", score: 70 },
          { date: "2026-09-14", score: 72 },
        ]),
      },
      {
        userId: learner.id,
        projectId: projectTransformers.id,
        conceptId: conceptC.id,
        masteryScore: 51.0,
        status: "NEEDS_ATTENTION",
        totalAttempts: 8,
        correctAttempts: 4,
        lastAssessedAt: new Date(),
        historyJson: JSON.stringify([
          { date: "2026-09-12", score: 45 },
          { date: "2026-09-15", score: 51 },
        ]),
      },
      {
        userId: learner.id,
        projectId: projectTransformers.id,
        conceptId: conceptD.id,
        masteryScore: 42.0,
        status: "NEEDS_ATTENTION",
        totalAttempts: 5,
        correctAttempts: 2,
        lastAssessedAt: new Date(),
        historyJson: JSON.stringify([
          { date: "2026-09-14", score: 42 },
        ]),
      },
    ],
  });

  // 6. Create Learning Materials and Chunks for Project 1
  const material1 = await prisma.material.create({
    data: {
      projectId: projectTransformers.id,
      title: "Attention Is All You Need (Paper Summary)",
      originalFilename: "attention_paper_notes.pdf",
      fileUrl: "/uploads/attention_paper_notes.pdf",
      fileSize: 425000,
      totalPages: 15,
      status: "READY",
      extractedText: "The Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.",
    },
  });

  await prisma.documentChunk.createMany({
    data: [
      {
        materialId: material1.id,
        projectId: projectTransformers.id,
        chunkIndex: 0,
        pageNumber: 3,
        content: "An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.",
        tokenCount: 65,
        concepts: JSON.stringify(["Self-Attention Mechanism"]),
      },
      {
        materialId: material1.id,
        projectId: projectTransformers.id,
        chunkIndex: 1,
        pageNumber: 4,
        content: "We compute the matrix of outputs as: Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V. We compute attention functions on a set of queries simultaneously, packed together into a matrix Q.",
        tokenCount: 48,
        concepts: JSON.stringify(["Scaled Dot-Product Formula", "Self-Attention Mechanism"]),
      },
      {
        materialId: material1.id,
        projectId: projectTransformers.id,
        chunkIndex: 2,
        pageNumber: 6,
        content: "Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d_k, d_k and d_v dimensions, respectively. MultiHead(Q, K, V) = Concat(head_1, ..., head_h) * W^O.",
        tokenCount: 68,
        concepts: JSON.stringify(["Multi-Head Attention"]),
      },
      {
        materialId: material1.id,
        projectId: projectTransformers.id,
        chunkIndex: 3,
        pageNumber: 14,
        content: "Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence. To this end, we add 'positional encodings' to the input embeddings at the bottoms of the encoder and decoder stacks.",
        tokenCount: 64,
        concepts: JSON.stringify(["Positional Encodings"]),
      },
    ],
  });

  // 7. Create Sample Actionable Recommendations (Answers: "What should I do next?")
  await prisma.recommendation.createMany({
    data: [
      {
        projectId: projectTransformers.id,
        userId: learner.id,
        type: "REVIEW_MATERIAL",
        title: "Review Positional Encodings Formulation",
        reason: "Your understanding of Positional Encodings is at 51%, with recent mistakes on sinusoidal frequency dimensions.",
        priority: "HIGH",
        targetUrl: `/spaces/${spaceAI.id}/projects/${projectTransformers.id}?tab=materials`,
      },
      {
        projectId: projectTransformers.id,
        userId: learner.id,
        type: "PRACTICE_QUIZ",
        title: "Take Adaptive Quiz on Multi-Head Attention",
        reason: "Concept is stable at 72%. A short 3-question adaptive quiz will reinforce subspace projection mechanics.",
        priority: "MEDIUM",
        targetUrl: `/spaces/${spaceAI.id}/projects/${projectTransformers.id}?tab=quiz`,
      },
    ],
  });

  // 8. Create Sample Tutor Conversation with Grounded Citations
  const conv = await prisma.conversation.create({
    data: {
      projectId: projectTransformers.id,
      userId: learner.id,
      title: "Query & Key Vector Scaling Explanation",
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv.id,
        role: "user",
        content: "Why do we scale the dot products by 1 / sqrt(d_k) in the self-attention formula?",
      },
      {
        conversationId: conv.id,
        role: "assistant",
        content: "We divide by $\\sqrt{d_k}$ because for large values of $d_k$, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients (gradient vanishing). Scaling by $\\frac{1}{\\sqrt{d_k}}$ counteracts this effect and maintains numerical stability during gradient descent.",
        citationsJson: JSON.stringify([
          {
            materialId: material1.id,
            title: "Attention Is All You Need (Paper Summary)",
            pageNumber: 4,
            snippet: "Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V",
          },
        ]),
        isUngrounded: false,
        latencyMs: 840,
        tokenCount: 165,
      },
    ],
  });

  // 8.1 Create Sample Quiz with Attempts for Repeated Mistake Detection
  const sampleQuiz = await prisma.quiz.create({
    data: {
      projectId: projectTransformers.id,
      userId: learner.id,
      title: "Transformer Fundamentals Assessment",
      totalQuestions: 2,
      score: 50,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  const questionMcq = await prisma.quizQuestion.create({
    data: {
      quizId: sampleQuiz.id,
      conceptId: conceptA.id,
      questionType: "MCQ",
      prompt: "What is the purpose of dividing the query-key dot product by sqrt(d_k)?",
      optionsJson: JSON.stringify([
        "To prevent softmax gradients from vanishing for large dimension sizes",
        "To speed up matrix multiplication hardware instructions",
        "To enforce sparsity in the attention weights",
        "To normalize input word embedding vector lengths",
      ]),
      correctOptionIndex: 0,
      explanation: "Scaling by sqrt(d_k) keeps the dot product magnitudes stable, avoiding vanishing gradients in softmax.",
    },
  });

  const questionMask = await prisma.quizQuestion.create({
    data: {
      quizId: sampleQuiz.id,
      conceptId: conceptD.id,
      questionType: "MCQ",
      prompt: "Why must autoregressive decoders use causal attention masks?",
      optionsJson: JSON.stringify([
        "To prevent decoder positions from attending to subsequent future tokens",
        "To compress the sequence length by half",
        "To increase model training throughput",
        "To eliminate the need for positional encodings",
      ]),
      correctOptionIndex: 0,
      explanation: "Causal masking ensures each position can only attend to earlier positions, preserving autoregressive generation.",
    },
  });

  // Create quiz attempts (Student got Causal Masking wrong twice)
  await prisma.quizAttempt.createMany({
    data: [
      {
        quizId: sampleQuiz.id,
        questionId: questionMcq.id,
        userId: learner.id,
        selectedOptionIndex: 0,
        isCorrect: true,
        score: 100,
      },
      {
        quizId: sampleQuiz.id,
        questionId: questionMask.id,
        userId: learner.id,
        selectedOptionIndex: 2, // wrong
        isCorrect: false,
        score: 0,
      },
    ],
  });

  // Create an earlier attempt on Causal Masking (so repeated mistake count = 2)
  const priorQuiz = await prisma.quiz.create({
    data: {
      projectId: projectTransformers.id,
      userId: learner.id,
      title: "Self-Attention Diagnostic Quiz",
      totalQuestions: 1,
      score: 0,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  const priorQuestion = await prisma.quizQuestion.create({
    data: {
      quizId: priorQuiz.id,
      conceptId: conceptD.id,
      questionType: "MCQ",
      prompt: "What happens if causal masking is omitted during decoder inference?",
      optionsJson: JSON.stringify([
        "The model leaks future tokens during generation",
        "The model produces NaN loss",
        "The attention matrix cannot be inverted",
        "Training speed decreases by 50%",
      ]),
      correctOptionIndex: 0,
      explanation: "Without causal masking, future tokens leak into current position representations.",
    },
  });
  await prisma.quizAttempt.create({
    data: {
      quizId: priorQuiz.id,
      questionId: priorQuestion.id,
      userId: learner.id,
      selectedOptionIndex: 3, // wrong
      isCorrect: false,
      score: 0,
    },
  });

  // Create Repeated Mistake Remediation Recommendation
  await prisma.recommendation.create({
    data: {
      projectId: projectTransformers.id,
      userId: learner.id,
      type: "REPEATED_MISTAKE_REMEDIATION",
      title: "🚨 Remediation: Causal Masking & Autoregressive Decoding",
      reason: "Persistent misconception detected: You have missed questions on 'Causal Masking & Autoregressive Decoding' 2 times. Review Page 4 of 'Attention Is All You Need' before taking your next quiz.",
      priority: "HIGH",
      targetUrl: `/projects/${projectTransformers.id}?tab=materials`,
    },
  });

  // 9. Create Sample AI Observability Logs (PRD Section 14)
  await prisma.aiLog.createMany({
    data: [
      {
        userId: learner.id,
        feature: "TUTOR",
        model: "gemini-2.5-flash",
        promptTokens: 420,
        completionTokens: 165,
        totalTokens: 585,
        latencyMs: 840,
        costEstimate: 0.00018,
        status: "SUCCESS",
        metadataJson: JSON.stringify({ projectId: projectTransformers.id, citationsCount: 1 }),
      },
      {
        userId: learner.id,
        feature: "CONCEPT_EXTRACTION",
        model: "gemini-2.5-pro",
        promptTokens: 1250,
        completionTokens: 210,
        totalTokens: 1460,
        latencyMs: 1420,
        costEstimate: 0.0011,
        status: "SUCCESS",
        metadataJson: JSON.stringify({ materialId: material1.id, extractedCount: 4 }),
      },
      {
        userId: learner.id,
        feature: "QUIZ_GENERATION",
        model: "gemini-2.5-flash",
        promptTokens: 520,
        completionTokens: 340,
        totalTokens: 860,
        latencyMs: 720,
        costEstimate: 0.00052,
        status: "SUCCESS",
        metadataJson: JSON.stringify({ quizId: sampleQuiz.id, questionsCount: 2 }),
      },
      {
        userId: learner.id,
        feature: "ASSESSMENT_EVALUATION",
        model: "gemini-2.5-flash",
        promptTokens: 380,
        completionTokens: 140,
        totalTokens: 520,
        latencyMs: 410,
        costEstimate: 0.00029,
        status: "SUCCESS",
        metadataJson: JSON.stringify({ questionId: questionMcq.id, score: 100 }),
      },
      {
        userId: learner.id,
        feature: "EVALUATION_BENCHMARK",
        model: "evaluation-suite-v1",
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
        latencyMs: 950,
        costEstimate: 0.0001,
        status: "SUCCESS",
        metadataJson: JSON.stringify({
          overallScore: 94,
          groundednessScore: 100,
          retrievalPrecisionScore: 92,
          gradingConsistencyScore: 90,
          passedCount: 6,
          totalCases: 6,
          benchmarkCases: [
            {
              name: "Relevant Query Retrieval",
              category: "RETRIEVAL",
              passed: true,
              score: 100,
              details: "Retrieved 2 verified chunks (topScore: 2.85).",
              latencyMs: 145,
            },
            {
              name: "Ungrounded Query Gate",
              category: "RETRIEVAL",
              passed: true,
              score: 100,
              details: "Successfully gated unrelated query with 0 evidence.",
              latencyMs: 82,
            },
            {
              name: "Anti-Hallucination Rejection",
              category: "GROUNDEDNESS",
              passed: true,
              score: 100,
              details: "AI Tutor correctly refused ungrounded prompt without hallucinating.",
              latencyMs: 210,
            },
            {
              name: "Citation Integrity & Grounding",
              category: "GROUNDEDNESS",
              passed: true,
              score: 100,
              details: "Grounded answer produced with transparent source attribution.",
              latencyMs: 340,
            },
            {
              name: "Exemplar Answer High Scoring",
              category: "GRADING",
              passed: true,
              score: 90,
              details: "Exemplar answer graded with score: 90% (expected >= 70%).",
              latencyMs: 195,
            },
            {
              name: "Deficient Answer Gap Detection",
              category: "GRADING",
              passed: true,
              score: 100,
              details: "Incomplete answer penalized appropriately with score: 45% (expected < 60%).",
              latencyMs: 165,
            },
          ],
        }),
      },
    ],
  });

  // 10. Create Sample Learning Events (PRD Section 12)
  await prisma.learningEvent.createMany({
    data: [
      {
        userId: learner.id,
        projectId: projectTransformers.id,
        eventType: "PROJECT_CREATED",
        payloadJson: JSON.stringify({ name: projectTransformers.name }),
      },
      {
        userId: learner.id,
        projectId: projectTransformers.id,
        eventType: "MATERIAL_UPLOADED",
        payloadJson: JSON.stringify({ materialTitle: material1.title }),
      },
      {
        userId: learner.id,
        projectId: projectTransformers.id,
        eventType: "MASTERY_UPDATED",
        payloadJson: JSON.stringify({ concept: "Self-Attention Mechanism", newScore: 88 }),
      },
    ],
  });

  console.log("✅ Seed completed successfully!");
  console.log(`Created 2 users, 2 spaces, 3 projects, 4 concepts, mastery records, materials, citations, and AI telemetry logs.`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
