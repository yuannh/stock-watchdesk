const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8010);
const STATIC_ALLOWLIST = new Set(["/", "/index.html", "/styles.css", "/app.js", "/README.md"]);
const LOCAL_HOSTS = new Set([
  `127.0.0.1:${PORT}`,
  `localhost:${PORT}`,
  `[::1]:${PORT}`,
]);

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((req, res) => {
  try {
    applySecurityHeaders(res);
    if (!isLocalRequest(req)) return sendText(res, "Forbidden", 403);
    const url = new URL(req.url, `http://${req.headers.host}`);
    return serveStatic(url, res);
  } catch (error) {
    return sendText(res, error.message || "Unexpected server error", 500);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`US Equity Command Center: http://127.0.0.1:${PORT}/index.html`);
});

function serveStatic(url, res) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  if (!STATIC_ALLOWLIST.has(pathname)) return sendText(res, "Not found", 404);

  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) return sendText(res, "Forbidden", 403);

  fs.readFile(filePath, (error, data) => {
    if (error) return sendText(res, "Not found", 404);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function isLocalRequest(req) {
  const host = req.headers.host || "";
  return LOCAL_HOSTS.has(host);
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
