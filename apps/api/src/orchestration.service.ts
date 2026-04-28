import { Injectable } from "@nestjs/common";
import { getExecution } from "@sonofcotester/data";
import { ExecutionGateway } from "./execution.gateway.js";

@Injectable()
export class OrchestrationService {
  constructor(private readonly gateway: ExecutionGateway) {}

  async publishRunById(runId: string) {
    const run = await getExecution(runId);
    if (run) {
      this.gateway.emitRunUpdate(run);
    }
  }
}
