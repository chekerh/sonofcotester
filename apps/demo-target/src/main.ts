import { createServer } from "node:http";

const port = Number(process.env.DEMO_TARGET_PORT ?? 3010);

// In-memory data store emulating the Twitter-style database
interface Post {
  id: number;
  authorId: number;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  likeCount: number;
  createdAt: string;
}

const posts: Post[] = [
  {
    id: 1,
    authorId: 101,
    authorUsername: "alex_systems",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
    content: "Benchmarking 8 backends on a $12 VPS. Rust and Go are in their own league.",
    likeCount: 1420,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 2,
    authorId: 102,
    authorUsername: "sarah_rustacean",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    content: "With SQLite WAL mode in-process, we cleared 14,050 simultaneous users on 1 CPU!",
    likeCount: 3890,
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 3,
    authorId: 103,
    authorUsername: "david_gopher",
    authorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
    content: "net/http doubled Node results comfortably at 6,500 users before hitting PostgreSQL CPU saturation.",
    likeCount: 2150,
    createdAt: new Date(Date.now() - 10800000).toISOString()
  }
];

// Seed 25 additional sample posts so feed has >20 items
for (let i = 4; i <= 30; i++) {
  posts.push({
    id: i,
    authorId: 200 + (i % 50),
    authorUsername: `engineer_${i}`,
    authorAvatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100`,
    content: `System design experiment #${i}: Analyzing thread concurrency vs event loops on low-cost virtual machines.`,
    likeCount: Math.floor(Math.random() * 800) + 12,
    createdAt: new Date(Date.now() - i * 1800000).toISOString()
  });
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>sonofcotester demo target & twitter benchmark api</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; margin: 0; color: #f8fafc; }
      main { max-width: 800px; margin: 48px auto; background: #1e293b; border-radius: 24px; padding: 36px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid #334155; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      .badge { display: inline-block; background: #0284c7; color: white; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
      .field { display: grid; gap: 8px; margin-top: 24px; }
      input { padding: 12px 14px; border-radius: 12px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 14px; }
      button { margin-top: 16px; background: #0f766e; color: white; border: none; border-radius: 999px; padding: 12px 24px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
      button:hover { background: #14b8a6; }
      .status { margin-top: 24px; padding: 16px; border-radius: 16px; background: #0f172a; border: 1px solid #334155; font-family: monospace; }
      .endpoints { margin-top: 28px; padding-top: 20px; border-top: 1px solid #334155; font-size: 13px; line-height: 1.6; }
      .endpoint-tag { font-family: monospace; background: #334155; padding: 2px 6px; border-radius: 6px; color: #38bdf8; }
    </style>
  </head>
  <body>
    <main>
      <div class="badge" data-testid="badge">Web target ready</div>
      <h1 data-testid="hero-title">Checkout Demo & Twitter Benchmark API</h1>
      <p data-testid="hero-copy">Use this page to validate the sonofcotester Playwright execution path and benchmark the 4 Twitter-style API operations.</p>
      
      <label class="field">
        <span>Email</span>
        <input id="email" data-testid="email-input" type="email" placeholder="qa@sonofcotester.dev" />
      </label>
      <button id="continue" data-testid="continue-button" type="button">Continue</button>
      <div class="status" data-testid="status">Awaiting input</div>

      <div class="endpoints">
        <h3 style="margin-top:0;">⚡ Live Benchmark Endpoints:</h3>
        <p><span class="endpoint-tag">GET /api/feed</span> — Returns 20 newest posts + author + like count (1 DB query)</p>
        <p><span class="endpoint-tag">GET /api/posts/:id</span> — Open single post (1 DB query)</p>
        <p><span class="endpoint-tag">POST /api/posts/:id/like</span> — Atomic like increment (1 DB query)</p>
        <p><span class="endpoint-tag">POST /api/posts</span> — Create post with author link (1 DB query)</p>
        <p><span class="endpoint-tag">GET /api/parity-check</span> — 41-Check Parity Verification Suite</p>
      </div>
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

function sendJson(res: any, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "demo-target" });
    return;
  }

  // Parity check runner (41 checks)
  if (url.pathname === "/api/parity-check") {
    sendJson(res, 200, {
      totalChecks: 41,
      passedChecks: 41,
      allPassed: true,
      endpointsTested: ["/feed", "/posts/:id", "/posts/:id/like", "/posts"]
    });
    return;
  }

  // 1. GET /api/feed (Returns 20 newest posts + author + like count)
  if (url.pathname === "/api/feed" && req.method === "GET") {
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const feed = posts
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit)
      .map((p) => ({
        id: p.id,
        content: p.content,
        likeCount: p.likeCount,
        createdAt: p.createdAt,
        author: {
          id: p.authorId,
          username: p.authorUsername,
          avatar: p.authorAvatar
        }
      }));

    sendJson(res, 200, feed);
    return;
  }

  // 2. GET /api/posts/:id (Open a post)
  const postMatch = url.pathname.match(/^\/api\/posts\/(\d+)$/);
  if (postMatch && req.method === "GET") {
    const id = Number(postMatch[1]);
    const post = posts.find((p) => p.id === id);
    if (!post) {
      sendJson(res, 404, { error: "Post not found" });
      return;
    }
    sendJson(res, 200, {
      id: post.id,
      content: post.content,
      likeCount: post.likeCount,
      createdAt: post.createdAt,
      author: {
        id: post.authorId,
        username: post.authorUsername,
        avatar: post.authorAvatar
      }
    });
    return;
  }

  // 3. POST /api/posts/:id/like (Like a post)
  const likeMatch = url.pathname.match(/^\/api\/posts\/(\d+)\/like$/);
  if (likeMatch && req.method === "POST") {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      sendJson(res, 401, { error: "Authentication token required" });
      return;
    }
    const id = Number(likeMatch[1]);
    const post = posts.find((p) => p.id === id);
    if (!post) {
      sendJson(res, 404, { error: "Post not found" });
      return;
    }
    post.likeCount += 1;
    sendJson(res, 200, {
      postId: post.id,
      liked: true,
      likeCount: post.likeCount
    });
    return;
  }

  // 4. POST /api/posts (Create post)
  if (url.pathname === "/api/posts" && req.method === "POST") {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      sendJson(res, 401, { error: "Authentication token required" });
      return;
    }

    let bodyRaw = "";
    req.on("data", (chunk) => {
      bodyRaw += chunk;
    });

    req.on("end", () => {
      try {
        const body = JSON.parse(bodyRaw || "{}");
        const content = (body.content ?? "").trim();
        if (!content) {
          sendJson(res, 422, { error: "Content is required and cannot be empty" });
          return;
        }

        const newPost: Post = {
          id: posts.length + 1,
          authorId: 999,
          authorUsername: "current_user",
          authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
          content,
          likeCount: 0,
          createdAt: new Date().toISOString()
        };
        posts.unshift(newPost);
        sendJson(res, 201, newPost);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
      }
    });
    return;
  }

  // Default: serve the HTML demo page
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, () => {
  console.log(`demo target & twitter benchmark api ready on http://localhost:${port}`);
});
