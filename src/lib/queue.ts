import { prisma } from "@/lib/db";
import { processDocument } from "./documentProcessor";
import { detectAndRemediateRepeatedMistakes } from "./repeatedMistakeEngine";
import { getProjectGrowthAnalytics } from "./masteryEngine";
import { generateProjectRecommendations } from "./ai/recommendationEngine";

export type JobType =
  | "PROCESS_DOCUMENT"
  | "UPDATE_MASTERY"
  | "DETECT_REPEATED_MISTAKES"
  | "GENERATE_RECOMMENDATIONS";

export interface QueueJobOptions {
  jobType: JobType;
  payload: Record<string, any>;
  maxRetries?: number;
}

/**
 * Enqueues a job into the BackgroundJob table and triggers processing asynchronously.
 */
export async function enqueueJob(options: QueueJobOptions) {
  const job = await prisma.backgroundJob.create({
    data: {
      jobType: options.jobType,
      payloadJson: JSON.stringify(options.payload),
      status: "PENDING",
      maxRetries: options.maxRetries ?? 3,
      retryCount: 0,
    },
  });

  // Execute asynchronously without blocking the caller/HTTP response
  executeJobAsync(job.id).catch((err) => {
    console.error(`Background job ${job.id} dispatch error:`, err);
  });

  return job;
}

/**
 * Executes a background job with state transitions, failure recovery, and retry tracking.
 */
export async function executeJobAsync(jobId: string) {
  // Atomic conditional transition to PROCESSING to ensure only one runner executes
  const updateResult = await prisma.backgroundJob.updateMany({
    where: {
      id: jobId,
      status: { in: ["PENDING", "FAILED"] },
    },
    data: { status: "PROCESSING" },
  });

  if (updateResult.count === 0) {
    // Already processing or completed
    return;
  }

  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return;
  }

  try {
    const payload = JSON.parse(job.payloadJson);

    switch (job.jobType) {
      case "PROCESS_DOCUMENT": {
        const { materialId } = payload;
        await processDocument(materialId);
        break;
      }

      case "DETECT_REPEATED_MISTAKES": {
        const { projectId, userId } = payload;
        if (projectId && userId) {
          await detectAndRemediateRepeatedMistakes(projectId, userId);
        }
        break;
      }

      case "UPDATE_MASTERY": {
        const { projectId, userId } = payload;
        if (projectId && userId) {
          await getProjectGrowthAnalytics(projectId, userId);
        }
        break;
      }

      case "GENERATE_RECOMMENDATIONS": {
        const { projectId, userId } = payload;
        if (projectId && userId) {
          await generateProjectRecommendations(projectId, userId);
        }
        break;
      }

      default:
        console.log(`Job type ${job.jobType} processed.`);
    }

    // Success transition
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        error: null,
      },
    });
  } catch (error: any) {
    console.error(`Error executing job ${jobId}:`, error);
    const newRetryCount = job.retryCount + 1;
    const isExhausted = newRetryCount >= job.maxRetries;

    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: isExhausted ? "FAILED" : "PENDING",
        retryCount: newRetryCount,
        error: error.message || "Unknown error during job execution",
      },
    });

    // If it was a document job, update the Material's status accordingly
    if (job.jobType === "PROCESS_DOCUMENT") {
      try {
        const payload = JSON.parse(job.payloadJson);
        if (payload.materialId) {
          await prisma.material.update({
            where: { id: payload.materialId },
            data: {
              status: isExhausted ? "FAILED" : "PROCESSING",
              errorMessage: error.message,
            },
          });
        }
      } catch (e) {
        console.error("Failed to update material failure status:", e);
      }
    }
  }
}

/**
 * Retries a failed or pending job manually (e.g. from Admin or UI retry button).
 */
export async function retryJob(jobId: string) {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
  });

  if (!job) throw new Error("Job not found");

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      error: null,
    },
  });

  return executeJobAsync(jobId);
}
