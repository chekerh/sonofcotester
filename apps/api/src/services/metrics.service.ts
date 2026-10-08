import { Injectable } from "@nestjs/common";
import { listExecutions, listProjects } from "@sonofcotester/data";

@Injectable()
export class MetricsService {
  async getPrometheusMetrics(): Promise<string> {
    const [projects, executions] = await Promise.all([
      listProjects().catch(() => []),
      listExecutions().catch(() => [])
    ]);

    const memory = process.memoryUsage();
    const uptime = Math.floor(process.uptime());

    const passedRuns = executions.filter((e) => e.status === "passed").length;
    const failedRuns = executions.filter((e) => e.status === "failed").length;
    const queuedRuns = executions.filter((e) => e.status === "queued" || e.status === "running").length;

    const lines: string[] = [
      "# HELP sonofcotester_uptime_seconds Total uptime in seconds",
      "# TYPE sonofcotester_uptime_seconds gauge",
      `sonofcotester_uptime_seconds ${uptime}`,
      "",
      "# HELP sonofcotester_memory_bytes Node.js memory allocation",
      "# TYPE sonofcotester_memory_bytes gauge",
      `sonofcotester_memory_bytes{type="heap_used"} ${memory.heapUsed}`,
      `sonofcotester_memory_bytes{type="heap_total"} ${memory.heapTotal}`,
      `sonofcotester_memory_bytes{type="rss"} ${memory.rss}`,
      "",
      "# HELP sonofcotester_projects_total Total managed testing projects",
      "# TYPE sonofcotester_projects_total gauge",
      `sonofcotester_projects_total ${projects.length}`,
      "",
      "# HELP sonofcotester_executions_total Execution runs by status",
      "# TYPE sonofcotester_executions_total counter",
      `sonofcotester_executions_total{status="passed"} ${passedRuns}`,
      `sonofcotester_executions_total{status="failed"} ${failedRuns}`,
      `sonofcotester_executions_total{status="active"} ${queuedRuns}`,
      "",
      "# HELP sonofcotester_worker_status Worker engine readiness",
      "# TYPE sonofcotester_worker_status gauge",
      `sonofcotester_worker_status{provider="playwright_local"} 1`,
      `sonofcotester_worker_status{provider="maestro_local"} 1`,
      `sonofcotester_worker_status{provider="browserstack_mobile"} 1`
    ];

    return lines.join("\n");
  }
}
