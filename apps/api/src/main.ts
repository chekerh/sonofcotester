import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./filters/http-exception.filter.js";
import { RequestIdMiddleware } from "./middleware/request-id.middleware.js";

const logger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
        : process.env.NODE_ENV === "production"
          ? false // Explicit origins required in production
          : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      exposedHeaders: ["X-Request-ID"],
      maxAge: 86400,
    },
    logger:
      process.env.NODE_ENV === "production"
        ? ["error", "warn", "log"]
        : ["error", "warn", "log", "debug", "verbose"],
    bufferLogs: true,
  });

  // ── Global prefix ──
  app.setGlobalPrefix("api");

  // ── Rate limiting is configured via ThrottlerModule.forRoot() in AppModule ──

  // ── Request ID middleware ──
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));

  // ── Validation ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages:
        process.env.NODE_ENV === "production" ? true : false,
    }),
  );

  // ── Global exception filter ──
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Security headers ──
  app.use((req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Powered-By", ""); // Hide framework info
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self' data:;",
      );
      res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
      );
    }
    next();
  });

  // ── Request logging ──
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      const requestId = req.headers?.["x-request-id"] ?? "-";
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "log";
      logger[level](
        `${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`,
      );
    });
    next();
  });

  // ── Graceful shutdown ──
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3101;
  await app.listen(port, "0.0.0.0");

  logger.log(`Son of CodeTester API listening on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? "development"}`);
  logger.log(`CORS: ${process.env.CORS_ORIGIN ?? (process.env.NODE_ENV === "production" ? "disabled (set CORS_ORIGIN)" : "open")}`);
  logger.log(`Rate limit: ${process.env.NODE_ENV === "production" ? "100/min, 10/sec burst" : "1000/min, 50/sec burst"}`);
}

void bootstrap();
