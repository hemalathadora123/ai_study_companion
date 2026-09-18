import { prisma } from "@/lib/db";

export interface ObservabilitySummary {
  totalCalls: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostEstimate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  featureBreakdown: {
    feature: string;
    count: number;
    tokens: number;
    cost: number;
    avgLatencyMs: number;
  }[];
  recentLogs: {
    id: string;
    feature: string;
    model: string;
    totalTokens: number;
    latencyMs: number;
    costEstimate: number;
    status: string;
    errorMessage?: string | null;
    createdAt: string;
    metadata?: Record<string, any> | null;
  }[];
}

/**
 * Aggregates platform-wide AI usage telemetry, token costs, and latency metrics.
 */
export async function getObservabilityMetrics(options?: {
  userId?: string;
  feature?: string;
  limit?: number;
}): Promise<ObservabilitySummary> {
  const where: any = {};
  if (options?.userId) where.userId = options.userId;
  if (options?.feature) where.feature = options.feature;

  const logs = await prisma.aiLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit || 200,
  });

  const totalCalls = logs.length;
  if (totalCalls === 0) {
    return {
      totalCalls: 0,
      successCount: 0,
      errorCount: 0,
      successRate: 100,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCostEstimate: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      featureBreakdown: [],
      recentLogs: [],
    };
  }

  let successCount = 0;
  let errorCount = 0;
  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalCostEstimate = 0;
  let totalLatencyMs = 0;

  const featureMap = new Map<
    string,
    { count: number; tokens: number; cost: number; totalLatency: number }
  >();

  const latencies: number[] = [];

  for (const log of logs) {
    if (log.status === "SUCCESS") {
      successCount++;
    } else {
      errorCount++;
    }

    totalTokens += log.totalTokens;
    promptTokens += log.promptTokens;
    completionTokens += log.completionTokens;
    totalCostEstimate += log.costEstimate;
    totalLatencyMs += log.latencyMs;
    latencies.push(log.latencyMs);

    const feat = featureMap.get(log.feature) || {
      count: 0,
      tokens: 0,
      cost: 0,
      totalLatency: 0,
    };
    feat.count++;
    feat.tokens += log.totalTokens;
    feat.cost += log.costEstimate;
    feat.totalLatency += log.latencyMs;
    featureMap.set(log.feature, feat);
  }

  // Calculate p95 latency
  latencies.sort((a, b) => a - b);
  const p95Index = Math.min(
    latencies.length - 1,
    Math.floor(latencies.length * 0.95)
  );
  const p95LatencyMs = latencies[p95Index] || 0;

  const featureBreakdown = Array.from(featureMap.entries()).map(
    ([feature, data]) => ({
      feature,
      count: data.count,
      tokens: data.tokens,
      cost: Number(data.cost.toFixed(5)),
      avgLatencyMs: Math.round(data.totalLatency / data.count),
    })
  );

  return {
    totalCalls,
    successCount,
    errorCount,
    successRate: Math.round((successCount / totalCalls) * 100),
    totalTokens,
    promptTokens,
    completionTokens,
    totalCostEstimate: Number(totalCostEstimate.toFixed(5)),
    averageLatencyMs: Math.round(totalLatencyMs / totalCalls),
    p95LatencyMs,
    featureBreakdown,
    recentLogs: logs.slice(0, 30).map((l) => {
      let meta = null;
      if (l.metadataJson) {
        try {
          meta = JSON.parse(l.metadataJson);
        } catch {}
      }
      return {
        id: l.id,
        feature: l.feature,
        model: l.model,
        totalTokens: l.totalTokens,
        latencyMs: l.latencyMs,
        costEstimate: Number(l.costEstimate.toFixed(5)),
        status: l.status,
        errorMessage: l.errorMessage,
        createdAt: l.createdAt.toISOString(),
        metadata: meta,
      };
    }),
  };
}
