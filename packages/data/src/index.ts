import { PrismaClient } from "@prisma/client";

declare global {
  var __sonofcotesterPrisma: PrismaClient | undefined;
}

const env =
  "process" in globalThis
    ? ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {})
    : {};

export const prisma =
  globalThis.__sonofcotesterPrisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (env.NODE_ENV !== "production") {
  globalThis.__sonofcotesterPrisma = prisma;
}

export * from "@prisma/client";
export * from "./repository.js";
