import { chromium, type Browser, type Page } from "playwright";
import { AccessibilityScanner } from "./a11y-scanner.js";

export interface DiscoveredElement {
  id: string;
  type: "button" | "input" | "link" | "select" | "heading";
  tag: string;
  text?: string;
  selector: string;
  role?: string;
  placeholder?: string;
  inputType?: string;
  name?: string;
  isVisible: boolean;
}

export interface CrawlResult {
  url: string;
  title: string;
  statusCode: number;
  screenshotBase64?: string;
  elements: DiscoveredElement[];
  formsCount: number;
  linksCount: number;
  buttonsCount: number;
  inputsCount: number;
  headings: string[];
  consoleErrors: string[];
  capturedAt: string;
  discoveredRoutes?: string[];
  a11yScore?: number;
  a11yViolationsCount?: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export class AppInspectorService {
  async inspect(targetUrl: string, timeoutMs: number = 8000): Promise<CrawlResult> {
    let browser: Browser | undefined;
    const consoleErrors: string[] = [];

    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true
      });
      const page: Page = await context.newPage();

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text().slice(0, 200));
        }
      });

      let statusCode = 200;
      const response = await page.goto(targetUrl, {
        timeout: timeoutMs,
        waitUntil: "domcontentloaded"
      }).catch((err) => {
        throw new Error(`Failed to navigate to ${targetUrl}: ${err.message}`);
      });

      if (response) {
        statusCode = response.status();
      }

      // Allow brief pause for client-side hydration (e.g. React/Vite/Next.js)
      await page.waitForTimeout(400);

      const title = await page.title().catch(() => "Untitled Page");

      // Capture real screenshot
      const screenshotBuffer = await page.screenshot({
        type: "jpeg",
        quality: 60,
        fullPage: false
      }).catch(() => null);

      const screenshotBase64 = screenshotBuffer
        ? `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`
        : undefined;

      // Extract interactive DOM elements
      const elements: DiscoveredElement[] = await page.evaluate(() => {
        const results: Array<{
          id: string;
          type: "button" | "input" | "link" | "select" | "heading";
          tag: string;
          text?: string;
          selector: string;
          role?: string;
          placeholder?: string;
          inputType?: string;
          name?: string;
          isVisible: boolean;
        }> = [];

        function getBestSelector(el: Element): string {
          const tag = el.tagName.toLowerCase();
          if (el.getAttribute("data-testid")) {
            return `[data-testid='${el.getAttribute("data-testid")}']`;
          }
          if (el.id) {
            return `#${el.id}`;
          }
          if (el.getAttribute("name")) {
            return `${tag}[name='${el.getAttribute("name")}']`;
          }
          const ariaLabel = el.getAttribute("aria-label");
          if (ariaLabel) {
            return `${tag}[aria-label='${ariaLabel}']`;
          }
          const placeholder = el.getAttribute("placeholder");
          if (placeholder) {
            return `${tag}[placeholder='${placeholder}']`;
          }
          const inputType = el.getAttribute("type");
          if (tag === "input" && inputType) {
            return `input[type='${inputType}']`;
          }
          const role = el.getAttribute("role");
          const text = el.textContent?.trim().slice(0, 25);
          if (role && text) {
            return `[role='${role}']`;
          }
          // Class-based selector
          const classList = Array.from(el.classList).filter((c) => !c.includes(":") && !c.includes("/") && !c.includes("[")).slice(0, 2);
          if (classList.length > 0) {
            return `${tag}.${classList.join(".")}`;
          }
          return tag;
        }

        // 1. Inputs & Textareas
        document.querySelectorAll("input, textarea, select").forEach((el) => {
          const input = el as HTMLInputElement;
          if (input.type === "hidden") return;
          const tag = el.tagName.toLowerCase();
          const rawType = input.type ? input.type.toLowerCase() : (tag === "textarea" ? "textarea" : "text");
          const isCheckOrRadio = rawType === "checkbox" || rawType === "radio";
          results.push({
            id: Math.random().toString(36).slice(2, 8),
            type: tag === "select" ? "select" : isCheckOrRadio ? "button" : "input",
            tag,
            selector: getBestSelector(el),
            placeholder: input.placeholder || undefined,
            inputType: rawType,
            name: input.name || undefined,
            isVisible: input.offsetParent !== null
          });
        });

        // 2. Buttons
        document.querySelectorAll("button, [role='button'], input[type='submit']").forEach((el) => {
          const btn = el as HTMLElement;
          const text = (btn.innerText || btn.textContent || "").trim().slice(0, 40);
          results.push({
            id: Math.random().toString(36).slice(2, 8),
            type: "button",
            tag: el.tagName.toLowerCase(),
            text: text || "Button",
            selector: getBestSelector(el),
            role: el.getAttribute("role") || "button",
            isVisible: btn.offsetParent !== null
          });
        });

        // 3. Prominent Links
        document.querySelectorAll("a[href]").forEach((el) => {
          const link = el as HTMLAnchorElement;
          const text = (link.innerText || "").trim().slice(0, 40);
          if (text.length > 1 && !link.href.startsWith("javascript:")) {
            results.push({
              id: Math.random().toString(36).slice(2, 8),
              type: "link",
              tag: "a",
              text,
              selector: getBestSelector(el),
              isVisible: link.offsetParent !== null
            });
          }
        });

        // 4. Headings
        document.querySelectorAll("h1, h2, h3").forEach((el) => {
          const text = (el.textContent || "").trim().slice(0, 60);
          if (text) {
            results.push({
              id: Math.random().toString(36).slice(2, 8),
              type: "heading",
              tag: el.tagName.toLowerCase(),
              text,
              selector: getBestSelector(el),
              isVisible: (el as HTMLElement).offsetParent !== null
            });
          }
        });

        return results.slice(0, 50); // Top 50 interactive elements
      }).catch(() => []);

      const headings = elements.filter((e) => e.type === "heading" && e.text).map((e) => e.text!);
      const inputsCount = elements.filter((e) => e.type === "input" || e.type === "select").length;
      const buttonsCount = elements.filter((e) => e.type === "button").length;
      const linksCount = elements.filter((e) => e.type === "link").length;

      // Automated Accessibility (WCAG 2.2 AA) Audit
      const pageHtml = await page.content().catch(() => "");
      let a11yScore = 100;
      let a11yViolationsCount = 0;
      if (pageHtml) {
        try {
          const a11yAudit = new AccessibilityScanner().auditHtml(pageHtml, targetUrl);
          a11yScore = a11yAudit.score;
          a11yViolationsCount = a11yAudit.violations.length;
        } catch {}
      }

      // Internal Application Route Discovery
      let targetOrigin = "";
      try {
        targetOrigin = new URL(targetUrl).origin;
      } catch {}

      const discoveredRoutes: string[] = await page.evaluate((origin) => {
        const routes = new Set<string>();
        routes.add("/");
        document.querySelectorAll("a[href]").forEach((el) => {
          const href = el.getAttribute("href");
          if (!href) return;
          if (href.startsWith("/") && !href.startsWith("//")) {
            const clean = href.split("#")[0].split("?")[0];
            if (clean && clean.length > 1) routes.add(clean);
          } else if (origin && href.startsWith(origin)) {
            try {
              const path = new URL(href).pathname;
              if (path && path.length > 1) routes.add(path);
            } catch {}
          }
        });
        return Array.from(routes).slice(0, 10);
      }, targetOrigin).catch(() => ["/"]);

      return {
        url: targetUrl,
        title,
        statusCode,
        screenshotBase64,
        elements,
        formsCount: inputsCount > 0 ? 1 : 0,
        linksCount,
        buttonsCount,
        inputsCount,
        headings,
        consoleErrors: consoleErrors.slice(0, 5),
        capturedAt: new Date().toISOString(),
        discoveredRoutes,
        a11yScore,
        a11yViolationsCount
      };
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
}
