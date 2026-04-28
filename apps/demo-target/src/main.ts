import { createServer } from "node:http";

const port = Number(process.env.DEMO_TARGET_PORT ?? 3010);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>sonofcotester demo target</title>
    <style>
      body { font-family: Arial, sans-serif; background: #fff7ed; margin: 0; color: #0f172a; }
      main { max-width: 720px; margin: 48px auto; background: white; border-radius: 24px; padding: 32px; box-shadow: 0 20px 60px rgba(15,23,42,0.12); }
      h1 { margin: 0 0 8px; }
      .field { display: grid; gap: 8px; margin-top: 24px; }
      input { padding: 12px 14px; border-radius: 14px; border: 1px solid #cbd5e1; }
      button { margin-top: 16px; background: #0f766e; color: white; border: none; border-radius: 999px; padding: 12px 20px; font-weight: 700; cursor: pointer; }
      .status { margin-top: 24px; padding: 16px; border-radius: 16px; background: #f8fafc; }
    </style>
  </head>
  <body>
    <main>
      <p data-testid="badge">Web target ready</p>
      <h1 data-testid="hero-title">Checkout Demo</h1>
      <p data-testid="hero-copy">Use this page to validate the sonofcotester Playwright execution path.</p>
      <label class="field">
        <span>Email</span>
        <input id="email" data-testid="email-input" type="email" placeholder="qa@sonofcotester.dev" />
      </label>
      <button id="continue" data-testid="continue-button" type="button">Continue</button>
      <div class="status" data-testid="status">Awaiting input</div>
    </main>
    <script>
      const input = document.getElementById("email");
      const button = document.getElementById("continue");
      const status = document.querySelector('[data-testid="status"]');
      button.addEventListener("click", () => {
        const value = input.value.trim();
        status.textContent = value ? "Ready for checkout" : "Missing email";
      });
    </script>
  </body>
</html>`;

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "demo-target" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, () => {
  console.log(`demo target ready on http://localhost:${port}`);
});

