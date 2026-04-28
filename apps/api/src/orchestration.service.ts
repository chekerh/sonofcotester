import { Injectable } from "@nestjs/common";
import type { ExecutionRun } from "@sonofcotester/sdk";
import { ExecutionGateway } from "./execution.gateway.js";

@Injectable()
export class OrchestrationService {
  constructor(private readonly gateway: ExecutionGateway) {}

  publishRun(run: ExecutionRun) {
    this.gateway.emitRunUpdate(run);
  }
}

