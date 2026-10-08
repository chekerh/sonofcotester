import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage.js";

describe("LandingPage", () => {
  it("presents the product promise, live proof, and both video formats", () => {
    const html = renderToStaticMarkup(<LandingPage onLaunch={() => undefined} />);

    expect(html).toContain("Your QA team just got");
    expect(html).toContain("an unfair advantage.");
    expect(html).toContain("Illustrative example, not a live run.");
    expect(html).toContain("DOM shift detected");
    expect(html).toContain("1 healed");
    expect(html).toContain("/hero-sequence/sonofcotester-cinematic.webm");
    expect(html).toContain("/hero-sequence/sonofcotester-cinematic.mp4");
    expect(html).toContain("Launch Console");
  });

  it("keeps navigation and actions keyboard-addressable", () => {
    const html = renderToStaticMarkup(<LandingPage onLaunch={() => undefined} />);

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Son of CoTester home"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-pressed="true"');
  });
});
