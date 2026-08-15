import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import type { ExecutionEventType, ExecutionRun, ExecutionStreamEvent } from "@sonofcotester/sdk";
import { EXECUTION_STREAM_CHANNEL } from "@sonofcotester/sdk";
import { ExecutionGateway } from "./execution.gateway.js";

@Injectable()
export class RunEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly publisher = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });

  private readonly subscriber = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null
  });

  constructor(private readonly gateway: ExecutionGateway) {}

  async onModuleInit() {
    await this.subscriber.subscribe(EXECUTION_STREAM_CHANNEL);
    this.subscriber.on("message", (channel, payload) => {
      if (channel !== EXECUTION_STREAM_CHANNEL) {
        return;
      }

      const event = JSON.parse(payload) as ExecutionStreamEvent;
      this.gateway.emitRunEvent(event);
    });
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
    await this.publisher.quit();
  }

  async publish(type: ExecutionEventType, run: ExecutionRun) {
    const event: ExecutionStreamEvent = {
      type,
      runId: run.id,
      run,
      timestamp: new Date().toISOString()
    };

    await this.publisher.publish(EXECUTION_STREAM_CHANNEL, JSON.stringify(event));
    return event;
  }
}
