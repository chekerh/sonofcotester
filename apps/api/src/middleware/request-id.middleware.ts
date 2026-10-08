import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Use existing X-Request-ID header if present, otherwise generate one
    const requestId =
      (req.headers["x-request-id"] as string) ||
      randomBytes(12).toString("hex");

    // Attach to request for downstream use
    (req as any).id = requestId;

    // Set response header
    res.setHeader("X-Request-ID", requestId);

    next();
  }
}
