import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import {
  BrowserStackMobileProvider,
  BrowserStackWebProvider,
  CustomAppiumProvider,
  PlaywrightLocalProvider,
  ProviderRegistry
} from "@sonofcotester/automation";
import { BugDraftService, HealingAnalysisService } from "@sonofcotester/ai";
import {
  ensureSeedData,
  getExecutionContext,
  markRunStarted,
  getExecution,
  updateRunResult
} from "@sonofcotester/data";
import { EXECUTION_STREAM_CHANNEL, type ExecutionEventType, type ExecutionRequest, type ExecutionRun } from "@sonofcotester/sdk";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const queueName = "execution-jobs";
const queue = new Queue(queueName, { connection });
const providers = new ProviderRegistry([
  new PlaywrightLocalProvider(),
  new BrowserStackWebProvider(),
  new BrowserStackMobileProvider(),
  new CustomAppiumProvider()
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
      context
    );

    const healingProposals =
      result.status === "healing-required" ? [healing.propose(context.testCases[0]?.id ?? "unknown", result.artifacts)] : [];
    const bugDrafts =
      result.status === "healing-required" ? [bugs.summarize("Worker-detected regression", result.artifacts)] : [];

    await updateRunResult(job.data.runId, result, healingProposals, bugDrafts);
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
