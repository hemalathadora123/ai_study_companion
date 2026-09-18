import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/queue";

export type DomainEventType =
  | "QUIZ_COMPLETED"
  | "QUIZ_GENERATED"
  | "TUTOR_INTERACTED"
  | "MATERIAL_PROCESSED"
  | "RECOMMENDATIONS_GENERATED"
  | "REPEATED_MISTAKES_DETECTED";

export interface LearningEventDispatchOptions {
  eventType: DomainEventType;
  userId: string;
  projectId?: string;
  payload?: Record<string, any>;
}

/**
 * Centralized Event Bus for asynchronous dispatching and learning event auditing.
 * Automatically triggers background workers (e.g. repeated mistake detector, mastery sync)
 * when relevant events fire.
 */
export async function emitLearningEvent(options: LearningEventDispatchOptions) {
  const { eventType, userId, projectId, payload = {} } = options;

  // 1. Immutable database audit log
  const eventRecord = await prisma.learningEvent.create({
    data: {
      userId,
      projectId: projectId || null,
      eventType,
      payloadJson: JSON.stringify(payload),
    },
  });

  // 2. Event-driven background worker triggers
  if (projectId) {
    if (eventType === "QUIZ_COMPLETED") {
      // Trigger background repeated mistake scanning
      enqueueJob({
        jobType: "DETECT_REPEATED_MISTAKES",
        payload: { projectId, userId },
      }).catch((err) => {
        console.error("Failed to enqueue DETECT_REPEATED_MISTAKES:", err);
      });

      // Trigger background mastery recalculation
      enqueueJob({
        jobType: "UPDATE_MASTERY",
        payload: { projectId, userId },
      }).catch((err) => {
        console.error("Failed to enqueue UPDATE_MASTERY:", err);
      });
    } else if (eventType === "TUTOR_INTERACTED") {
      // Update mastery when learner interacts with tutor
      enqueueJob({
        jobType: "UPDATE_MASTERY",
        payload: { projectId, userId },
      }).catch((err) => {
        console.error("Failed to enqueue UPDATE_MASTERY:", err);
      });
    }
  }

  return eventRecord;
}
