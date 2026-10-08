import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Redis } from "ioredis";
import type { ExecutionEventType, ExecutionRun, ExecutionStreamEvent } from "@sonofcotester/sdk";
import { EXECUTION_STREAM_CHANNEL } from "@sonofcotester/sdk";
import { ExecutionGateway } from "./execution.gateway.js";

@Injectable()
export class RunEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly publisher = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true
  });

  private readonly subscriber = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true
  });

  constructor(private readonly gateway: ExecutionGateway) {
    this.publisher.on("error", () => {});
    this.subscriber.on("error", () => {});
  }

  async onModuleInit() {
    try {
      await this.subscriber.connect().catch(() => {});
      await this.publisher.connect().catch(() => {});
      await this.subscriber.subscribe(EXECUTION_STREAM_CHANNEL).catch(() => {});
      this.subscriber.on("message", (channel, payload) => {
        if (channel !== EXECUTION_STREAM_CHANNEL) {
          return;
        }

        const event = JSON.parse(payload) as ExecutionStreamEvent;
        this.gateway.emitRunEvent(event);
      });
    } catch {}
  }

  async onModuleDestroy() {
    try {
      this.subscriber.disconnect();
      this.publisher.disconnect();
    } catch {}
  }

  async publish(type: ExecutionEventType, run: ExecutionRun) {
    const event: ExecutionStreamEvent = {
      type,
      runId: run.id,
      run,
      timestamp: new Date().toISOString()
    };

    try {
      await this.publisher.publish(EXECUTION_STREAM_CHANNEL, JSON.stringify(event));
    } catch {
      // Redis offline, emit directly to local gateway
      this.gateway.emitRunEvent(event);
    }
    return event;
  }
}
