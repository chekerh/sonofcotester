import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  BrowserStackMobileProvider,
  BrowserStackWebProvider,
  CustomAppiumProvider,
  MaestroCloudExecutionProvider,
  MaestroLocalProvider,
  PlaywrightLocalProvider,
  ProviderRegistry
} from "@sonofcotester/automation";
import { BugDraftService, HealingAnalysisService } from "@sonofcotester/ai";
import {
  ensureSeedData,
  getExecutionContext,
  markRunStarted,
  getExecution,
  updateRunResult,
  recordUsage
} from "@sonofcotester/data";
import { EXECUTION_STREAM_CHANNEL, type ExecutionEventType, type ExecutionRequest, type ExecutionRun } from "@sonofcotester/sdk";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 100, 3000)
});
connection.on("error", (err) => {
  console.warn(`[Worker] Redis connection warning: ${err.message}`);
});

const queueName = "execution-jobs";
const queue = new Queue(queueName, { connection });
const providers = new ProviderRegistry([
  new PlaywrightLocalProvider(),
  new BrowserStackWebProvider(),
  new BrowserStackMobileProvider(),
  new CustomAppiumProvider(),
  new MaestroLocalProvider() as any,
  new MaestroCloudExecutionProvider()
]);
const healing = new HealingAnalysisService();
const bugs = new BugDraftService();

type ExecutionJob = {
  runId: string;
  request: ExecutionRequest;
};

async function publishRunEvent(type: ExecutionEventType, run: ExecutionRun) {
  await connection.publish(
    EXECUTION_STREAM_CHANNEL,
    JSON.stringify({
      type,
      runId: run.id,
      run,
      timestamp: new Date().toISOString()
    })
  );
}

new Worker<ExecutionJob>(
  queueName,
  async (job) => {
    await markRunStarted(job.data.runId);
    const startedRun = await getExecution(job.data.runId);
    if (startedRun) {
      await publishRunEvent("started", startedRun);
    }
    const context = await getExecutionContext(job.data.request.suiteVersionId);
    const provider = providers.get(job.data.request.provider);
    const result = await provider.execute(
      job.data.request,
      context,
      async (_event, partialRun) => {
        if (startedRun) {
          await publishRunEvent("started", {
            ...startedRun,
            status: "running",
            stepEvents: [...partialRun.stepEvents]
          });
        }
      }
    );

    const failedEvent = result.stepEvents.find((e) => e.status === "failed");
    const failedCase = context.testCases.find((c) => c.id === failedEvent?.testCaseId) ?? context.testCases[0];
    const failedStep = failedCase?.steps.find((s) => s.id === failedEvent?.stepId);

    const healingProposals =
      result.status === "healing-required"
        ? [
            {
              ...(await healing.proposeWithModel(
                failedCase?.id ?? "unknown",
                result.artifacts,
                result.errorMessage,
                failedStep?.action,
                failedStep?.target
              )),
              executionId: job.data.runId
            }
          ]
        : [];

    const bugDrafts =
      result.status === "healing-required"
        ? [await bugs.summarizeWithModel("Worker-detected regression", result.artifacts, result.errorMessage)]
        : [];

    await updateRunResult(job.data.runId, result, healingProposals, bugDrafts);
    await recordUsage("ws_internal", "run", 1).catch(() => undefined);
    const completedRun = await getExecution(job.data.runId);
    if (completedRun) {
      const eventType: ExecutionEventType =
        completedRun.status === "passed"
          ? "completed"
          : completedRun.status === "healing-required"
            ? "healing-ready"
            : "failed";
      await publishRunEvent(eventType, completedRun);
    }
    return result;
  },
  { connection }
);

async function bootstrap() {
  await ensureSeedData();
  await queue.waitUntilReady();
  console.log("sonofcotester worker ready");
}

void bootstrap();
