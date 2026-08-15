import { Injectable } from "@nestjs/common";
import { getExecution } from "@sonofcotester/data";
import { RunEventsService } from "./run-events.service.js";

@Injectable()
export class OrchestrationService {
  constructor(private readonly runEvents: RunEventsService) {}

  async publishRunById(runId: string) {
    const run = await getExecution(runId);
    if (run) {
      await this.runEvents.publish("queued", run);
    }
  }
}
