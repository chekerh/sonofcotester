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
  projectId: string;
  suiteId: string;
  testCaseId: string;
  request: ExecutionRequest;
};

new Worker<ExecutionJob>(
  queueName,
  async (job) => {
    const provider = providers.get(job.data.request.provider);
    const run = await provider.execute(job.data.request, {
      projectId: job.data.projectId,
      suiteId: job.data.suiteId,
      testCases: []
    });

    if (run.status === "healing-required") {
      run.healingProposals.push(healing.propose(job.data.testCaseId, run.artifacts));
      run.bugDrafts.push(bugs.summarize("Worker-detected regression", run.artifacts));
    }

    return run;
  },
  { connection }
);

async function bootstrap() {
  await queue.waitUntilReady();
  console.log("sonofcotester worker ready");
}

void bootstrap();
