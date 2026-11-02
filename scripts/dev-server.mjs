// Local preview: npm run dev, then open http://localhost:3000
// Serves public/ and runs api/chat.js the way Vercel does.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/chat.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const config = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const globalHeaders = config.headers.find((h) => h.source === "/(.*)").headers;

createServer(async (req, res) => {
  for (const h of globalHeaders) res.setHeader(h.key, h.value);
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/api/chat") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try { req.body = JSON.parse(raw); } catch { req.body = {}; }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return handler(req, res);
  }
  const file = normalize(join(pub, path === "/" ? "index.html" : path));
  if (!file.startsWith(pub)) { res.statusCode = 403; return res.end(); }
  try {
    const data = await readFile(file);
    res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
    res.end(data);
  } catch { res.statusCode = 404; res.end("Not found"); }
}).listen(port, () => console.log(`Voca running at http://localhost:${port}`));
