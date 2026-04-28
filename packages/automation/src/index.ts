import type {
  CanonicalTestCase,
  ExecutionArtifact,
  ExecutionRequest,
  ExecutionRun,
  ProviderName,
  RunStatus
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

export interface ExecutionContext {
  projectId: string;
  suiteId: string;
  testCases: CanonicalTestCase[];
}

export interface ExecutionProvider {
  readonly name: ProviderName;
  execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun>;
}

abstract class BaseProvider implements ExecutionProvider {
  abstract readonly name: ProviderName;
  abstract execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun>;

  protected makeArtifacts(): ExecutionArtifact[] {
    const now = new Date().toISOString();
    return [
      { id: uid(), type: "log", label: "execution-log", url: "/artifacts/log.txt", createdAt: now },
      { id: uid(), type: "trace", label: "playwright-trace", url: "/artifacts/trace.zip", createdAt: now },
      { id: uid(), type: "screenshot", label: "failure-state", url: "/artifacts/failure.png", createdAt: now }
    ];
  }

  protected makeRun(request: ExecutionRequest, context: ExecutionContext, status: RunStatus): ExecutionRun {
    return {
      id: uid(),
      suiteId: context.suiteId,
      suiteVersionId: request.suiteVersionId,
      provider: this.name,
      environment: request.environment,
      status,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      matrix: request.matrix,
      artifacts: this.makeArtifacts(),
      healingProposals: [],
      bugDrafts: []
    };
  }
}

export class PlaywrightLocalProvider extends BaseProvider {
  readonly name = "playwright-local" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    return this.makeRun(request, context, "healing-required");
  }
}

export class BrowserStackWebProvider extends BaseProvider {
  readonly name = "browserstack-web" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    return this.makeRun(request, context, "passed");
  }
}

export class BrowserStackMobileProvider extends BaseProvider {
  readonly name = "browserstack-mobile" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    return this.makeRun(request, context, "passed");
  }
}

export class CustomAppiumProvider extends BaseProvider {
  readonly name = "custom-appium" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    return this.makeRun(request, context, "queued");
  }
}

export class ProviderRegistry {
  private readonly providers: Map<ProviderName, ExecutionProvider>;

  constructor(providers: ExecutionProvider[]) {
    this.providers = new Map(providers.map((provider) => [provider.name, provider]));
  }

  get(name: ProviderName): ExecutionProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unsupported provider: ${name}`);
    }
    return provider;
  }
}
