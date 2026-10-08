import { Injectable } from "@nestjs/common";
import { StudentTestingTutor } from "@sonofcotester/ai";
import { getStudentProgress, saveStudentProgress } from "@sonofcotester/data";
import type {
  AcademyModule,
  StudentProgressRecord,
  SyntaxTranslationRequest,
  SyntaxTranslationResult,
  TestQualityReport
} from "@sonofcotester/sdk";

@Injectable()
export class AcademyService {
  private readonly tutor = new StudentTestingTutor();

  getCurriculum(): AcademyModule[] {
    return this.tutor.getCurriculum();
  }

  async analyzeTest(code: string, platform: "web" | "mobile" = "web", modelName?: string): Promise<TestQualityReport> {
    return this.tutor.analyzeTestWithModel(code, platform, modelName);
  }

  async translateSyntax(req: SyntaxTranslationRequest, modelName?: string): Promise<SyntaxTranslationResult> {
    return this.tutor.translateSyntaxWithModel(req, modelName);
  }

  async getProgress(userId: string = "user_student"): Promise<StudentProgressRecord> {
    const record = await getStudentProgress(userId);
    if (!record) {
      return {
        userId,
        completedModules: [],
        moduleQuizScores: {},
        earnedBadges: [],
        totalTestsAnalyzed: 0,
        averageQualityScore: 0
      };
    }
    return record;
  }

  async submitQuiz(
    userId: string = "user_student",
    moduleId: string,
    score: number
  ): Promise<StudentProgressRecord> {
    const current = await this.getProgress(userId);
    const completed = new Set(current.completedModules);
    if (score >= 80) {
      completed.add(moduleId);
    }
    const scores = { ...current.moduleQuizScores, [moduleId]: score };

    const badges = [...current.earnedBadges];
    if (moduleId === "module-1" && score >= 90 && !badges.some((b) => b.id === "badge_pyramid_master")) {
      badges.push({
        id: "badge_pyramid_master",
        title: "Pyramid Architect",
        description: "Mastered test pyramid balance and test levels",
        earnedAt: new Date().toISOString(),
        icon: "🔺"
      });
    }
    if (moduleId === "module-2" && score >= 90 && !badges.some((b) => b.id === "badge_selector_pro")) {
      badges.push({
        id: "badge_selector_pro",
        title: "Selector Ninja",
        description: "Wrote resilient role-based accessible selectors",
        earnedAt: new Date().toISOString(),
        icon: "🎯"
      });
    }

    return saveStudentProgress(userId, {
      completedModules: Array.from(completed),
      moduleQuizScores: scores,
      earnedBadges: badges
    });
  }

  async recordTestAnalysis(userId: string = "user_student", qualityScore: number): Promise<StudentProgressRecord> {
    const current = await this.getProgress(userId);
    const newTotal = current.totalTestsAnalyzed + 1;
    const newAvg = current.totalTestsAnalyzed === 0
      ? qualityScore
      : Math.round(((current.averageQualityScore * current.totalTestsAnalyzed) + qualityScore) / newTotal);

    return saveStudentProgress(userId, {
      totalTestsAnalyzed: newTotal,
      averageQualityScore: newAvg
    });
  }
}
