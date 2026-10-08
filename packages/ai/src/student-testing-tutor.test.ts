import { describe, expect, it } from "vitest";
import { StudentTestingTutor } from "./student-testing-tutor.js";

describe("StudentTestingTutor (Executable Contract)", () => {
  const tutor = new StudentTestingTutor();

  it("exposes all 6 core curriculum modules", () => {
    const modules = tutor.getCurriculum();
    expect(modules).toHaveLength(6);
    expect(modules.every((m) => m.quizQuestions.length > 0 && m.keyConcepts.length > 0)).toBe(true);
  });

  describe("Anti-pattern & Quality Linter", () => {
    const cases = [
      {
        scenario: "Arbitrary sleep timeout",
        code: "await page.waitForTimeout(4000); await page.click('#btn');",
        expectedPattern: "arbitrary_sleep",
        expectPassingGrade: false
      },
      {
        scenario: "Brittle chained XPath locator",
        code: "await page.locator('div > div > div:nth-child(2) > button').click();",
        expectedPattern: "brittle_locator",
        expectPassingGrade: false
      },
      {
        scenario: "Resilient accessible role selector",
        code: "await page.getByRole('button', { name: 'Submit' }).click(); await expect(page.getByTestId('msg')).toBeVisible();",
        expectedPattern: null,
        expectPassingGrade: true
      }
    ];

    it.each(cases)("evaluates $scenario", ({ code, expectedPattern, expectPassingGrade }) => {
      const report = tutor.analyzeTest(code, "web");
      if (expectedPattern) {
        expect(report.antiPatterns.some((ap) => ap.type === expectedPattern)).toBe(true);
        expect(report.score).toBeLessThan(80);
      } else {
        expect(report.antiPatterns).toHaveLength(0);
        expect(report.score).toBeGreaterThanOrEqual(90);
      }
      expect(report.grade.startsWith("A")).toBe(expectPassingGrade);
    });
  });

  describe("3-Way Syntax Translation", () => {
    const translationTable = [
      {
        target: "maestro" as const,
        sourceCode: "await page.goto('http://localhost:3000'); await page.getByRole('button', { name: 'Login' }).click();",
        expectedTokens: ["appId:", "tapOn:"]
      },
      {
        target: "cypress" as const,
        sourceCode: "await page.goto('http://localhost:3000'); await page.click('#submit-btn');",
        expectedTokens: ["cy.visit", "cy.get"]
      }
    ];

    it.each(translationTable)("translates Playwright to $target", ({ target, sourceCode, expectedTokens }) => {
      const res = tutor.translateSyntax({
        sourceSyntax: "playwright",
        targetSyntax: target,
        code: sourceCode
      });
      expect(res.targetSyntax).toBe(target);
      expectedTokens.forEach((token) => expect(res.translatedCode).toContain(token));
    });
  });
});
