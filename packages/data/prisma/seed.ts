/**
 * Production seed script — initializes the database with a default workspace,
 * admin user, and starter project.
 *
 * Usage: npx tsx packages/data/prisma/seed.ts
 * Or:    DATABASE_URL=... npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["info"],
});

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Workspace ──
  const workspace = await prisma.workspace.upsert({
    where: { id: "ws-default" },
    update: {},
    create: {
      id: "ws-default",
      name: "Default Workspace",
      description: "Son of CodeTester default workspace — created on first boot",
    },
  });
  console.log(`  ✓ Workspace: ${workspace.name} (${workspace.id})`);

  // ── Admin user ──
  const user = await prisma.user.upsert({
    where: { email: "admin@sonofcotester.dev" },
    update: {},
    create: {
      id: "user-admin",
      workspaceId: workspace.id,
      email: "admin@sonofcotester.dev",
      name: "Admin",
      role: "owner",
    },
  });
  console.log(`  ✓ User: ${user.name} <${user.email}> (${user.role})`);

  // ── Starter project ──
  const project = await prisma.project.upsert({
    where: { id: "proj-starter" },
    update: {},
    create: {
      id: "proj-starter",
      workspaceId: workspace.id,
      name: "Starter Project",
      description: "A demo project to explore Son of CodeTester features. Run a scan or generate tests to get started!",
    },
  });
  console.log(`  ✓ Project: ${project.name} (${project.id})`);

  // ── Health trend baseline ──
  const existingTrend = await prisma.healthTrendPoint.findFirst({
    where: { projectId: project.id },
  });
  if (!existingTrend) {
    await prisma.healthTrendPoint.create({
      data: {
        id: "trend_starter_init",
        projectId: project.id,
        overallScore: 85,
        securityScore: 80,
        uiScore: 90,
        dbScore: 85,
        performanceScore: 82,
      },
    });
    console.log("  ✓ Health trend baseline created");
  }

  console.log("\n✅ Seed complete!\n");
  console.log("   Login:  admin@sonofcotester.dev");
  console.log("   Project: Starter Project (proj-starter)\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
