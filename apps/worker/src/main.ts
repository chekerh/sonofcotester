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
  updateRunResult
} from "@sonofcotester/data";
import type { ExecutionRequest } from "@sonofcotester/sdk";

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

new Worker<ExecutionJob>(
  queueName,
  async (job) => {
    await markRunStarted(job.data.runId);
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
