import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { HealthService } from "../services/health.service.js";
import type { HealthStreamEvent, HealthEventType, HealthDimension } from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

@WebSocketGateway({ namespace: "/health", cors: { origin: "*" }, transports: ["websocket"] })
export class HealthGateway implements OnGatewayConnection, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly watchers = new Map<string, Set<string>>();

  constructor(private readonly healthService: HealthService) {}

  handleConnection(client: Socket) {
    console.log(`[health] client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[health] client disconnected: ${client.id}`);
    for (const [, clients] of this.watchers) {
      clients.delete(client.id);
    }
  }

  @SubscribeMessage("watch:project")
  handleWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    client.join(`health:${projectId}`);

    if (!this.watchers.has(projectId)) {
      this.watchers.set(projectId, new Set());
    }
    this.watchers.get(projectId)!.add(client.id);

    return { event: "watch:acknowledged", data: { projectId } };
  }

  @SubscribeMessage("unwatch:project")
  handleUnwatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    client.leave(`health:${projectId}`);
    this.watchers.get(projectId)?.delete(client.id);

    return { event: "unwatch:acknowledged", data: { projectId } };
  }

  @SubscribeMessage("run:full-scan")
  async handleFullScan(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; targetUrl?: string },
  ) {
    const overview = await this.healthService.runFullScan(
      data.projectId,
      data.targetUrl ?? "http://localhost:3010",
    );

    this.broadcastToProject(data.projectId, {
      type: "health-score-changed",
      projectId: data.projectId,
      dimension: "security",
      timestamp: new Date().toISOString(),
      data: { overallScore: overview.overallScore },
      summary: `Full scan complete. Overall health: ${overview.overallScore}/100`,
    });

    return { event: "scan:completed", data: overview };
  }

  @SubscribeMessage("run:security-scan")
  async handleSecurityScan(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const scan = await this.healthService.runSecurityScan(data);

    for (const vuln of scan.vulnerabilities) {
      this.broadcastToProject(data.projectId, {
        type: "vulnerability-found",
        projectId: data.projectId,
        dimension: "security",
        timestamp: new Date().toISOString(),
        data: vuln as unknown as Record<string, unknown>,
        summary: `Found: ${vuln.title} (${vuln.severity})`,
      });
    }

    return { event: "security-scan:completed", data: scan };
  }

  @SubscribeMessage("get:overview")
  handleGetOverview(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    return { event: "overview", data: this.healthService.getHealthOverview(data.projectId) };
  }

  broadcastToProject(projectId: string, event: HealthStreamEvent) {
    this.server?.to(`health:${projectId}`).emit("health:event", event);
  }

  /**
   * Called by services to push real-time health events.
   */
  pushEvent(projectId: string, type: HealthEventType, dimension: HealthDimension, data: Record<string, unknown>, summary: string) {
    const event: HealthStreamEvent = {
      type,
      projectId,
      dimension,
      timestamp: new Date().toISOString(),
      data,
      summary,
    };
    this.broadcastToProject(projectId, event);
  }
}
