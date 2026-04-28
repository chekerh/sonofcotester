import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  ExecutionRun,
  GeneratedTestSuiteDraft,
  HealingProposal,
  ProjectSummary
} from "@sonofcotester/sdk";

type StoredSuite = {
  id: string;
  projectId: string;
  versionId: string;
  draft: GeneratedTestSuiteDraft;
};

type DevStoreState = {
  projects: ProjectSummary[];
  suites: StoredSuite[];
  runs: ExecutionRun[];
  healProposals: HealingProposal[];
};

const defaultState = (): DevStoreState => ({
  projects: [
    {
      id: "proj_demo",
      name: "Checkout Web",
      description: "Primary storefront regression pack"
    },
    {
      id: "proj_mobile",
      name: "Companion App",
      description: "Mobile smoke coverage"
    }
  ],
  suites: [],
  runs: [],
  healProposals: []
});

export class DevStore {
  private readonly filePath = resolve(process.cwd(), ".sonofcotester", "store.json");

  async read(): Promise<DevStoreState> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as DevStoreState;
    } catch {
      const initial = defaultState();
      await this.write(initial);
      return initial;
    }
  }

  async write(state: DevStoreState) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2));
  }
}

export type { StoredSuite, DevStoreState };

