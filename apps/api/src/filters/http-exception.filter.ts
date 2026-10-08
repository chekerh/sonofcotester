import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

const logger = new Logger("HttpExceptionFilter");

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request as any).id ?? request.headers?.["x-request-id"] ?? "-";
    const timestamp = new Date().toISOString();
    const path = request.originalUrl;
    const method = request.method;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let error = "Internal Server Error";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === "string") {
        message = exResponse;
        error = exception.name;
      } else if (typeof exResponse === "object" && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        error = (obj.error as string) ?? error;
        details = obj.details ?? obj.validation ?? undefined;
      }
    } else if (exception instanceof Error) {
      message =
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : exception.message;
      error = exception.name;
    }

    // Log server errors
    if (status >= 500) {
      logger.error(
        `${requestId} ${method} ${path} ${status} ${exception instanceof Error ? exception.message : "unknown"}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      details,
      path,
      method,
      timestamp,
      requestId,
    });
  }
}
