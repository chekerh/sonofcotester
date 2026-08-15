import { SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";
import type { ExecutionStreamEvent } from "@sonofcotester/sdk";

@WebSocketGateway({
  cors: { origin: "*" },
  namespace: "/executions"
})
export class ExecutionGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage("run:watch")
  handleRunWatch(client: { join: (room: string) => void }, payload: { runId?: string }) {
    if (payload.runId) {
      client.join(`run:${payload.runId}`);
    }
  }

  emitRunEvent(event: ExecutionStreamEvent) {
    if (this.server) {
      this.server.emit("run:event", event);
      this.server.to(`run:${event.runId}`).emit("run:event", event);
    }
  }
}
