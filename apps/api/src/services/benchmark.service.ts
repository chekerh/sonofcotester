import { Injectable } from "@nestjs/common";
import {
  BenchmarkEngine,
  DEFAULT_DATABASE_CONFIG,
  DEFAULT_DATASET,
  DEFAULT_SERVER_SPECS,
  DEFAULT_THRESHOLDS,
  DEFAULT_WORKLOAD,
  STACK_PROFILES
} from "@sonofcotester/automation";
import type {
  BackendStackId,
  FullShootoutConfig,
  FullShootoutRun,
  ParityCheckResult,
  ServerSpecs
} from "@sonofcotester/sdk";

@Injectable()
export class BenchmarkService {
  private readonly engine = new BenchmarkEngine();
  private readonly history: Map<string, FullShootoutRun> = new Map();

  constructor() {
    // Seed initial default benchmark run representing the YouTube experiment
    const defaultRun = this.engine.runFullShootout({
      name: "$12 VPS 8-Language Twitter API Shootout (YouTube Baseline)",
      specs: DEFAULT_SERVER_SPECS,
      stacks: [
        "rust-axum",
        "go-nethttp",
        "java-springboot",
        "csharp-aspnet",
        "bun-express",
        "node-express",
        "python-fastapi",
        "php-bare",
        "php-octane",
        "php-laravel"
      ],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });
    this.history.set(defaultRun.id, defaultRun);
  }

  /**
   * Predefined standard benchmark configurations matching real production scenarios.
   */
  getPresets(): Array<{
    id: string;
    name: string;
    description: string;
    config: FullShootoutConfig;
  }> {
    return [
      {
        id: "preset-vps-8-languages",
        name: "YouTube Experiment: $12 VPS 8-Language Shootout",
        description: "Exact replication of the video experiment on a 1 vCPU (2.3GHz), 2GB RAM, 50GB storage host running Node, Bun, Python, PHP, C#, Java, Go, and Rust with PostgreSQL.",
        config: {
          specs: DEFAULT_SERVER_SPECS,
          stacks: [
            "rust-axum",
            "go-nethttp",
            "java-springboot",
            "csharp-aspnet",
            "bun-express",
            "node-express",
            "python-fastapi",
            "php-bare",
            "php-octane",
            "php-laravel"
          ],
          database: DEFAULT_DATABASE_CONFIG,
          dataset: DEFAULT_DATASET,
          workload: DEFAULT_WORKLOAD,
          thresholds: DEFAULT_THRESHOLDS
        }
      },
      {
        id: "preset-sqlite-showdown",
        name: "PostgreSQL vs SQLite WAL Mode Showdown",
        description: "Eliminating the separate database process IPC and letting the compiled languages cook in-process. Demonstrates Rust surging from 6,900 to 14,050 users.",
        config: {
          specs: DEFAULT_SERVER_SPECS,
          stacks: [
            "rust-axum",
            "go-nethttp",
            "java-springboot",
            "node-express"
          ],
          database: {
            ...DEFAULT_DATABASE_CONFIG,
            engine: "sqlite-wal",
            walMode: true
          },
          dataset: DEFAULT_DATASET,
          workload: DEFAULT_WORKLOAD,
          thresholds: DEFAULT_THRESHOLDS
        }
      },
      {
        id: "preset-php-deepdive",
        name: "PHP Architecture Shootout: Laravel vs Octane vs Bare PHP",
        description: "Analyzes the 750 vs 1,250 vs 2,700 user scaling delta caused by per-request framework bootstrapping in PHP-FPM.",
        config: {
          specs: DEFAULT_SERVER_SPECS,
          stacks: ["php-bare", "php-octane", "php-laravel"],
          database: DEFAULT_DATABASE_CONFIG,
          dataset: DEFAULT_DATASET,
          workload: DEFAULT_WORKLOAD,
          thresholds: DEFAULT_THRESHOLDS
        }
      },
      {
        id: "preset-compiled-tier",
        name: "Top Tier Duel: Rust vs Go",
        description: "Direct head-to-head comparison of Axum vs net/http hitting the PostgreSQL 60% CPU wall.",
        config: {
          specs: DEFAULT_SERVER_SPECS,
          stacks: ["rust-axum", "go-nethttp"],
          database: DEFAULT_DATABASE_CONFIG,
          dataset: DEFAULT_DATASET,
          workload: DEFAULT_WORKLOAD,
          thresholds: DEFAULT_THRESHOLDS
        }
      }
    ];
  }

  /**
   * Retrieves all available stack profiles with metadata.
   */
  getStackProfiles() {
    return Object.values(STACK_PROFILES);
  }

  /**
   * Executes a benchmark shootout based on user-provided or modified configuration.
   */
  async runShootout(config: FullShootoutConfig): Promise<FullShootoutRun> {
    const run = this.engine.runFullShootout(config);
    this.history.set(run.id, run);
    return run;
  }

  /**
   * Runs the 41-check Parity Unit Test suite.
   */
  async runParityTest(baseUrl?: string): Promise<ParityCheckResult> {
    return this.engine.runParityTest(baseUrl);
  }

  /**
   * Generates a fully executable K6 script string for downloading or running via CLI.
   */
  generateK6Script(config: FullShootoutConfig): { script: string } {
    const script = this.engine.generateK6Script(config);
    return { script };
  }

  /**
   * Returns list of previous benchmark runs.
   */
  getHistory(): FullShootoutRun[] {
    return Array.from(this.history.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Returns a specific benchmark run by ID.
   */
  getRunById(id: string): FullShootoutRun | null {
    return this.history.get(id) ?? null;
  }
}
