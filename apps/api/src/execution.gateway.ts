import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";
import type { ExecutionRun } from "@sonofcotester/sdk";

@WebSocketGateway({
  cors: { origin: "*" },
  namespace: "/executions"
})
export class ExecutionGateway {
  @WebSocketServer()
  server!: Server;

  emitRunUpdate(run: ExecutionRun) {
    if (this.server) {
      this.server.emit("run:update", run);
    }
  }
}

