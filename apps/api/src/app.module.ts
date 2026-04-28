import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { ExecutionGateway } from "./execution.gateway.js";
import { OrchestrationService } from "./orchestration.service.js";

@Module({
  controllers: [AppController],
  providers: [AppService, OrchestrationService, ExecutionGateway]
})
export class AppModule {}

