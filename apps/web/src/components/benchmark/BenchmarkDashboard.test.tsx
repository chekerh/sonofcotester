import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BenchmarkDashboard } from "./BenchmarkDashboard.js";

describe("BenchmarkDashboard", () => {
  it("renders the $12 VPS shootout banner and controls", () => {
    const html = renderToStaticMarkup(<BenchmarkDashboard />);

    expect(html).toContain("Backend Language &amp; VPS Capacity Shootout");
    expect(html).toContain("Run Full Shootout");
    expect(html).toContain("41-Check Parity Test");
    expect(html).toContain("Export K6 Script");
  });

  it("renders interactive parameter modifiers for CPU, RAM, and Database", () => {
    const html = renderToStaticMarkup(<BenchmarkDashboard />);

    expect(html).toContain("VPS Hardware Specs");
    expect(html).toContain("vCPU Cores");
    expect(html).toContain("Storage Engine");
    expect(html).toContain("PostgreSQL (IPC)");
    expect(html).toContain("SQLite (WAL In-Proc)");
    expect(html).toContain("Failure Criteria (The 3 Hard Limits)");
  });

  it("renders tabs for capacity leaderboard, SQLite vs Postgres, and architectural diagnostics", () => {
    const html = renderToStaticMarkup(<BenchmarkDashboard />);

    expect(html).toContain("Capacity Leaderboard");
    expect(html).toContain("PostgreSQL vs SQLite WAL");
    expect(html).toContain("Architectural Diagnostics");
  });
});
