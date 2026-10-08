import type {
  LocalAiStatus,
  OllamaModelInfo
} from "@sonofcotester/sdk";

export interface GenerateOptions {
  model?: string;
  system?: string;
  format?: "json";
  temperature?: number;
  timeoutMs?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class OllamaClient {
  private readonly endpoint: string;
  private activeModel: string | null = null;

  constructor(endpoint?: string) {
    this.endpoint =
      endpoint ||
      process.env.OLLAMA_HOST ||
      process.env.OLLAMA_URL ||
      "http://127.0.0.1:11434";
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  getActiveModel(): string | null {
    return this.activeModel;
  }

  setActiveModel(model: string): void {
    this.activeModel = model;
  }

  /**
   * Check if Ollama daemon is reachable.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(2000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * List all models installed locally in Ollama.
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: OllamaModelInfo[] };
      return data.models || [];
    } catch {
      return [];
    }
  }

  /**
   * Get full status of local Ollama including available models and recommendations.
   */
  async getStatus(): Promise<LocalAiStatus> {
    const models = await this.listModels();
    const available = models.length > 0;

    // Determine the best recommended model for test generation and coding
    let recommendedModel: string | undefined;
    const names = models.map((m) => m.name.toLowerCase());

    if (names.some((n) => n.includes("qwen2.5:7b") || n.includes("qwen2.5-coder"))) {
      recommendedModel = models.find((m) => m.name.toLowerCase().includes("qwen2.5:7b"))?.name;
    } else if (names.some((n) => n.includes("phi3"))) {
      recommendedModel = models.find((m) => m.name.toLowerCase().includes("phi3"))?.name;
    } else if (names.some((n) => n.includes("qwen2.5:0.5b") || n.includes("qwen"))) {
      recommendedModel = models.find((m) => m.name.toLowerCase().includes("qwen"))?.name;
    } else if (models.length > 0) {
      recommendedModel = models[0].name;
    }

    if (!this.activeModel && recommendedModel) {
      this.activeModel = recommendedModel;
    }

    return {
      available,
      endpoint: this.endpoint,
      activeModel: this.activeModel || recommendedModel || null,
      installedModels: models,
      recommendedModel
    };
  }

  /**
   * Generate text using the active or specified local model.
   */
  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const model = options.model || this.activeModel || "qwen2.5:0.5b";
    const timeoutMs = options.timeoutMs || 45000;

    const payload: Record<string, unknown> = {
      model,
      prompt,
      stream: false
    };

    if (options.system) payload.system = options.system;
    if (options.format) payload.format = options.format;
    if (options.temperature !== undefined) {
      payload.options = { temperature: options.temperature };
    }

    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama generate error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as { response?: string };
    return json.response ?? "";
  }

  /**
   * Generate structured JSON output with automatic parsing.
   */
  async generateJson<T>(prompt: string, options: Omit<GenerateOptions, "format"> = {}): Promise<T | null> {
    try {
      const raw = await this.generate(prompt, { ...options, format: "json" });
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Chat conversation using the active or specified local model.
   */
  async chat(messages: ChatMessage[], options: GenerateOptions = {}): Promise<string> {
    const model = options.model || this.activeModel || "qwen2.5:0.5b";
    const timeoutMs = options.timeoutMs || 45000;

    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: false
    };

    if (options.format) payload.format = options.format;
    if (options.temperature !== undefined) {
      payload.options = { temperature: options.temperature };
    }

    const res = await fetch(`${this.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama chat error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as { message?: { content?: string } };
    return json.message?.content ?? "";
  }
}

export const defaultOllamaClient = new OllamaClient();
