export interface AcademyModule {
  id: string;
  number: number;
  title: string;
  badge: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  description: string;
  keyConcepts: string[];
  sampleCode: {
    language: "playwright" | "maestro" | "cypress";
    code: string;
    explanation: string;
  };
  quizQuestions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TestAntiPattern {
  type: "brittle_locator" | "arbitrary_sleep" | "missing_assertion" | "missing_a11y" | "redundant_action" | "overly_broad_scope";
  severity: "critical" | "warning" | "tip";
  title: string;
  message: string;
  lineSnippet?: string;
  recommendation: string;
  fixedSnippet?: string;
}

export interface TestQualityReport {
  score: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  summary: string;
  antiPatterns: TestAntiPattern[];
  strengths: string[];
  metrics: {
    stepCount: number;
    assertionCount: number;
    resilientLocatorRatio: number; // 0 to 1
    hasAccessibilityChecks: boolean;
    estimatedExecutionSpeed: "fast" | "moderate" | "slow";
  };
}

export interface SyntaxTranslationRequest {
  sourceSyntax: "playwright" | "maestro" | "cypress" | "natural_language";
  targetSyntax: "playwright" | "maestro" | "cypress";
  code: string;
}

export interface SyntaxTranslationResult {
  sourceSyntax: string;
  targetSyntax: string;
  translatedCode: string;
  notes: string[];
}

export interface StudentProgressRecord {
  userId: string;
  completedModules: string[];
  moduleQuizScores: Record<string, number>;
  earnedBadges: Array<{
    id: string;
    title: string;
    description: string;
    earnedAt: string;
    icon: string;
  }>;
  totalTestsAnalyzed: number;
  averageQualityScore: number;
}
